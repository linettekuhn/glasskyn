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
import type { UserPreference } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "./themed-text";
import GlassSurface from "./glass-surface";

type TimeTarget = "water" | "am" | "pm";

const DIGEST_DEFAULT_TIMES: Record<"am" | "pm", string> = {
  am: "08:00",
  pm: "20:00",
};

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<UserPreference | null>(null);
  const [timeTarget, setTimeTarget] = useState<TimeTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const checkNotificationPermission = useCallback(() => {
    Notifications.getPermissionsAsync()
      .then(({ status }) => setPermissionStatus(status))
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
    } else {
      update({ water_reminder_time: time });
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
        {saving ? "Saving…" : "Reminders are delivered as push notifications."}
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
