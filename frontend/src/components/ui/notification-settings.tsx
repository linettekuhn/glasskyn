import { useState, useEffect, useCallback } from "react";
import {
  View,
  Switch,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Platform,
  Modal,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { getPreferences, savePreferences } from "@/api/preferences";
import type { UserPreference } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "./themed-text";

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<UserPreference | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  useEffect(() => {
    getPreferences()
      .then(setPrefs)
      .catch(() => {});
  }, []);

  const update = useCallback((patch: Partial<UserPreference>) => {
    setPrefs((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaving(true);
    savePreferences(patch)
      .catch(() => {})
      .finally(() => setSaving(false));
  }, []);

  const timeDate = (() => {
    const [h, m] = (prefs?.water_reminder_time ?? "12:00")
      .split(":")
      .map(Number);
    const d = new Date();
    d.setHours(h || 12, m || 0, 0, 0);
    return d;
  })();

  const onTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== "ios") {
      setShowTimePicker(false);
    }
    if (event.type === "dismissed" || !date) return;
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    update({ water_reminder_time: `${hh}:${mm}` });
  };

  if (!prefs) {
    return null;
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.neutral[200] }]}>
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
          onPress={() => setShowTimePicker(true)}
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
        <ThemedText type="bodyLarge">Routine reminders</ThemedText>
        <Switch
          value={prefs.routine_digest_enabled}
          onValueChange={(v: boolean) => update({ routine_digest_enabled: v })}
          trackColor={{ true: colors.secondary[500] }}
        />
      </View>

      {Platform.OS === "ios" && (
        <Modal
          visible={showTimePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                { backgroundColor: colors.background },
              ]}
            >
              <View style={styles.modalHeader}>
                <ThemedText type="bodyLarge" weight="semiBold">
                  Water reminder time
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setShowTimePicker(false)}
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
                onChange={onTimeChange}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === "android" && showTimePicker && (
        <DateTimePicker
          value={timeDate}
          mode="time"
          display="default"
          onChange={onTimeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
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
