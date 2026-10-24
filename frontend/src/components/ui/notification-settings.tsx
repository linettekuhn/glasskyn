import { useState, useEffect, useCallback } from "react";
import {
  View,
  Switch,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Platform,
  Modal,
  AppState,
  Linking,
} from "react-native";
import * as Notifications from "expo-notifications";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { getPreferences, savePreferences } from "@/api/preferences";
import { requestSpfReminderPermission } from "@/services/spf-reminders";
import type { UserPreference } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "./themed-text";
import GlassSurface from "./glass-surface";

type TimeTarget = "water" | "am" | "pm" | "spfStart" | "spfEnd";

const DIGEST_DEFAULT_TIMES: Record<"am" | "pm", string> = {
  am: "08:00",
  pm: "20:00",
};

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<UserPreference | null>(null);
  const [timeTarget, setTimeTarget] = useState<TimeTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [spfPermDenied, setSpfPermDenied] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const checkNotificationPermission = useCallback(() => {
    Notifications.getPermissionsAsync()
      .then(({ status }) => {
        setPermissionStatus(status);
        if (status === "granted") setSpfPermDenied(false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    checkNotificationPermission();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkNotificationPermission();
      }
    });
    return () => sub.remove();
  }, [checkNotificationPermission]);

  useEffect(() => {
    getPreferences()
      .then((fetched) => {
        setPrefs(fetched);
        if (!fetched.timezone) {
          let deviceTz: string | null = null;
          try {
            deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
          } catch {
            deviceTz = null;
          }
          if (deviceTz) {
            update({ timezone: deviceTz });
          }
        }
      })
      .catch(() => {});
  }, []);

  const update = useCallback((patch: Partial<UserPreference>) => {
    setPrefs((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaving(true);
    savePreferences(patch)
      .catch(() => {})
      .finally(() => setSaving(false));
  }, []);

  const showTimePicker = timeTarget !== null;

  const timeDate = (() => {
    const value =
      timeTarget === "am"
        ? prefs?.routine_digest_am_time
        : timeTarget === "pm"
          ? prefs?.routine_digest_pm_time
          : timeTarget === "spfStart"
            ? (prefs?.spf_window_start ?? "08:00")
            : timeTarget === "spfEnd"
              ? (prefs?.spf_window_end ?? "18:00")
              : (prefs?.water_reminder_time ?? "12:00");
    const [h, m] = (value ?? "12:00").split(":").map(Number);
    const d = new Date();
    d.setHours(h || 12, m || 0, 0, 0);
    return d;
  })();

  const pickerTitle =
    timeTarget === "am"
      ? "Morning routine time"
      : timeTarget === "pm"
        ? "Evening routine time"
        : timeTarget === "spfStart"
          ? "Sun hours start"
          : timeTarget === "spfEnd"
            ? "Sun hours end"
            : "Water reminder time";

  const onTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== "ios") {
      setTimeTarget(null);
    }
    if (event.type === "dismissed" || !date || !timeTarget) return;
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const time = `${hh}:${mm}`;
    if (timeTarget === "am") {
      update({ routine_digest_am_time: time });
    } else if (timeTarget === "pm") {
      update({ routine_digest_pm_time: time });
    } else if (timeTarget === "spfStart") {
      update({ spf_window_start: time });
    } else if (timeTarget === "spfEnd") {
      update({ spf_window_end: time });
    } else {
      update({ water_reminder_time: time });
    }
  };

  const handleSpfToggle = async (value: boolean) => {
    if (!value) {
      update({ spf_reminder_enabled: false });
      return;
    }
    const granted = await requestSpfReminderPermission();
    setSpfPermDenied(!granted);
    if (granted) {
      update({ spf_reminder_enabled: true });
    }
  };

  if (!prefs) {
    return null;
  }

  return (
    <GlassSurface style={styles.card}>
      {permissionStatus === "denied" && (
        <View style={[styles.banner, { backgroundColor: colors.neutral[100] }]}>
          <ThemedText
            type="bodySmall"
            style={{ flex: 1, color: colors.neutral[700] }}
          >
            Notifications are turned off for Glasskyn. Reminders won't be
            delivered until you enable them in Settings.
          </ThemedText>
          <TouchableOpacity onPress={() => Linking.openSettings()}>
            <ThemedText type="bodySmall" style={{ color: colors.primary[600] }}>
              Open Settings
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
      <ThemedText type="captionSmall" style={{ color: colors.neutral[500] }}>
        {saving
          ? "Saving…"
          : "Water and routine reminders arrive as push notifications; SPF reminders arrive on this device."}
      </ThemedText>
      <View style={styles.row}>
        <ThemedText type="bodyLarge">Water reminder</ThemedText>
        <Switch
          value={prefs.water_reminder_enabled}
          onValueChange={(v: boolean) => update({ water_reminder_enabled: v })}
          trackColor={{ true: colors.secondary[500] }}
        />
      </View>

      {prefs.water_reminder_enabled && (
        <TouchableOpacity
          style={styles.row}
          onPress={() => setTimeTarget("water")}
        >
          <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
            Remind me at
          </ThemedText>
          <ThemedText type="bodyLarge" weight="semiBold">
            {prefs.water_reminder_time}
          </ThemedText>
        </TouchableOpacity>
      )}

      <View style={styles.row}>
        <ThemedText type="bodyLarge">Sunscreen reapply reminder</ThemedText>
        <Switch
          value={prefs.spf_reminder_enabled}
          onValueChange={(v: boolean) => {
            void handleSpfToggle(v);
          }}
          trackColor={{ true: colors.secondary[500] }}
        />
      </View>

      {spfPermDenied && !prefs.spf_reminder_enabled && (
        <View style={{ gap: 4 }}>
          <ThemedText
            type="captionSmall"
            style={{ color: colors.neutral[600] }}
          >
            Notifications are off, so sunscreen reminders can&apos;t fire.
          </ThemedText>
          <TouchableOpacity onPress={() => void Linking.openSettings()}>
            <ThemedText
              type="caption"
              weight="medium"
              style={{ color: colors.secondary[700] }}
            >
              Open Settings
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {prefs.spf_reminder_enabled && (
        <>
          <TouchableOpacity
            style={styles.row}
            onPress={() => setTimeTarget("spfStart")}
          >
            <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
              Sun hours start
            </ThemedText>
            <ThemedText type="bodyLarge" weight="semiBold">
              {prefs.spf_window_start ?? "08:00"}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => setTimeTarget("spfEnd")}
          >
            <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
              Sun hours end
            </ThemedText>
            <ThemedText type="bodyLarge" weight="semiBold">
              {prefs.spf_window_end ?? "18:00"}
            </ThemedText>
          </TouchableOpacity>

          {prefs.spf_window_start != null &&
            prefs.spf_window_end != null &&
            prefs.spf_window_end <= prefs.spf_window_start && (
              <ThemedText
                type="captionSmall"
                style={{ color: colors.neutral[600] }}
              >
                Sun hours end should be after the start. Reminders pause until
                fixed.
              </ThemedText>
            )}
        </>
      )}

      <ThemedText type="bodyLarge">Routine reminders</ThemedText>

      <View style={styles.row}>
        <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
          Morning (AM)
        </ThemedText>
        <Switch
          value={prefs.routine_digest_am_time != null}
          onValueChange={(v: boolean) =>
            update({
              routine_digest_am_time: v ? DIGEST_DEFAULT_TIMES.am : null,
            })
          }
          trackColor={{ true: colors.secondary[500] }}
        />
      </View>

      {prefs.routine_digest_am_time != null && (
        <TouchableOpacity
          style={styles.row}
          onPress={() => setTimeTarget("am")}
        >
          <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
            Remind me at
          </ThemedText>
          <ThemedText type="bodyLarge" weight="semiBold">
            {prefs.routine_digest_am_time}
          </ThemedText>
        </TouchableOpacity>
      )}

      <View style={styles.row}>
        <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
          Evening (PM)
        </ThemedText>
        <Switch
          value={prefs.routine_digest_pm_time != null}
          onValueChange={(v: boolean) =>
            update({
              routine_digest_pm_time: v ? DIGEST_DEFAULT_TIMES.pm : null,
            })
          }
          trackColor={{ true: colors.secondary[500] }}
        />
      </View>

      {prefs.routine_digest_pm_time != null && (
        <TouchableOpacity
          style={styles.row}
          onPress={() => setTimeTarget("pm")}
        >
          <ThemedText type="bodySmall" style={{ color: colors.neutral[600] }}>
            Remind me at
          </ThemedText>
          <ThemedText type="bodyLarge" weight="semiBold">
            {prefs.routine_digest_pm_time}
          </ThemedText>
        </TouchableOpacity>
      )}

      {Platform.OS === "ios" && (
        <Modal
          visible={showTimePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setTimeTarget(null)}
        >
          <View style={styles.modalOverlay}>
            <GlassSurface
              style={styles.modalContent}
              radius={12}
              border={false}
            >
              <View style={styles.modalHeader}>
                <ThemedText type="bodyLarge" weight="semiBold">
                  {pickerTitle}
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setTimeTarget(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <ThemedText
                    type="bodyLarge"
                    style={{ color: colors.primary[600] }}
                  >
                    Done
                  </ThemedText>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={timeDate}
                mode="time"
                display="inline"
                minuteInterval={5}
                onChange={onTimeChange}
              />
            </GlassSurface>
          </View>
        </Modal>
      )}

      {Platform.OS === "android" && showTimePicker && (
        <DateTimePicker
          value={timeDate}
          mode="time"
          display="default"
          minuteInterval={5}
          onChange={onTimeChange}
        />
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
});
