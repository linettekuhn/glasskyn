import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  deriveSpfState,
  localDateString,
  startOfLocalDay,
  type SpfState,
} from "@/lib/spf-state";

export const SPF_CATEGORY_ID = "spf-reapply";
export const SPF_APPLIED_ACTION_ID = "spf-applied";
const SPF_NOTIFICATION_PREFIX = "spf-reapply-";
const SPF_ANDROID_CHANNEL_ID = "spf-reminders";

let categoryReady = false;

/** Register the "Applied" action + Android channel. Safe to call repeatedly. */
export async function ensureSpfCategory(): Promise<void> {
  if (categoryReady) return;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(SPF_ANDROID_CHANNEL_ID, {
        name: "Sunscreen reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.setNotificationCategoryAsync(SPF_CATEGORY_ID, [
      {
        identifier: SPF_APPLIED_ACTION_ID,
        buttonTitle: "Applied",
        options: { opensAppToForeground: false },
      },
    ]);
    categoryReady = true;
  } catch (error) {
    console.warn("[spf-reminders] Failed to register category", error);
  }
}

export async function requestSpfReminderPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

async function cancelSpfNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(SPF_NOTIFICATION_PREFIX))
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier),
        ),
    );
  } catch (error) {
    console.warn("[spf-reminders] Failed to cancel", error);
  }
}

export interface SpfReminderInput {
  lastAppliedAt: Date | null;
  intervalMin: number;
  windowStartMin: number;
  windowEndMin: number;
  indoorsDate: string | null;
  remindersEnabled: boolean;
  /** Reused by callers/tests to assert on the computed state. */
  now?: Date;
}

/**
 * Single entry point: cancel the one pending SPF notification, then schedule
 * a new one only when a fresh countdown is running inside the daytime
 * window. Idempotent — safe to call on every mutation and foreground.
 */
export async function resyncSpfReminder(
  input: SpfReminderInput,
): Promise<SpfState | null> {
  const {
    lastAppliedAt,
    intervalMin,
    windowStartMin,
    windowEndMin,
    indoorsDate,
    remindersEnabled,
    now = new Date(),
  } = input;

  await cancelSpfNotifications();

  if (!remindersEnabled || intervalMin <= 0) return null;

  let permissionGranted = false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    permissionGranted = status === "granted";
  } catch {
    return null;
  }
  if (!permissionGranted) return null;

  const intervalMs = intervalMin * 60 * 1000;
  const dueAt =
    lastAppliedAt != null ? lastAppliedAt.getTime() + intervalMs : null;
  const windowEndToday =
    startOfLocalDay(now).getTime() + windowEndMin * 60 * 1000;
  // Lapsed once 2h past due or the window closes, whichever comes first.
  const lapseAfterMs =
    dueAt != null
      ? Math.max(0, Math.min(2 * 60 * 60 * 1000, windowEndToday - dueAt))
      : 2 * 60 * 60 * 1000;

  const { state } = deriveSpfState({
    now,
    lastAppliedAt,
    intervalMs,
    windowStartMin,
    windowEndMin,
    indoorsDate,
    lapseAfterMs,
  });

  if (state !== "fresh" || dueAt == null || dueAt <= now.getTime()) {
    return state;
  }

  // A due time outside today's window never schedules: the tile goes
  // Resting at window close instead of nagging in the evening.
  const dueDate = new Date(dueAt);
  const dueMin = dueDate.getHours() * 60 + dueDate.getMinutes();
  if (
    localDateString(dueDate) !== localDateString(now) ||
    dueMin < windowStartMin ||
    dueMin >= windowEndMin
  ) {
    return state;
  }

  try {
    await ensureSpfCategory();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time to reapply SPF",
        body: "Your sun protection wore off. Tap to log and get reminded again.",
        data: { kind: "spf-reapply" },
        categoryIdentifier: SPF_CATEGORY_ID,
        ...(Platform.OS === "android"
          ? { channelId: SPF_ANDROID_CHANNEL_ID }
          : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(dueAt),
      },
      identifier: `${SPF_NOTIFICATION_PREFIX}${dueAt}`,
    });
  } catch (error) {
    console.warn("[spf-reminders] Failed to schedule", error);
  }
  return state;
}
