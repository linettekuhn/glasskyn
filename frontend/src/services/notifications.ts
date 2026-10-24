import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { registerPushToken, unregisterPushToken } from "../api/notifications";
import { applySpf } from "../api/spf";
import {
  SPF_APPLIED_ACTION_ID,
  ensureSpfCategory,
} from "./spf-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let cachedPushToken: string | null = null;

export async function getExpoPushToken(): Promise<string | null> {
  if (cachedPushToken) {
    return cachedPushToken;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId:
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId,
  });
  cachedPushToken = tokenData.data;
  return cachedPushToken;
}

export async function getPushToken(): Promise<string | null> {
  if (cachedPushToken) {
    return cachedPushToken;
  }
  return getExpoPushToken();
}

function isSpfReapply(response: Notifications.NotificationResponse): boolean {
  const data = response.notification.request.content.data;
  return (
    data != null && typeof data === "object" && data.kind === "spf-reapply"
  );
}

function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  if (isSpfReapply(response)) {
    if (response.actionIdentifier === SPF_APPLIED_ACTION_ID) {
      // Lock-screen log: hit the API directly (no hook available here).
      // Best-effort — failures reconcile on next focus refetch.
      applySpf(new Date().toISOString()).catch(() => {});
    }
    router.navigate({ pathname: "/(main)", params: { focus: "spf" } });
    return;
  }
  router.push("/(modals)/notifications");
}

export function setupNotificationListeners(): () => void {
  void ensureSpfCategory();
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    })
    .catch(() => {});

  return () => {
    responseSubscription.remove();
  };
}

export async function registerPushNotificationsWithBackend(): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (!token) {
      return;
    }
    await registerPushToken(token, Platform.OS);
  } catch (error) {
    console.warn("[notifications] Failed to register push token", error);
  }
}

export async function unregisterPushNotificationsFromBackend(): Promise<void> {
  if (!cachedPushToken) {
    return;
  }
  try {
    await unregisterPushToken(cachedPushToken);
  } catch (error) {
    console.warn("[notifications] Failed to unregister push token", error);
  } finally {
    cachedPushToken = null;
  }
}
