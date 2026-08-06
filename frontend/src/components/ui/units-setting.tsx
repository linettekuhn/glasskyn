import { useEffect, useState, useCallback } from "react";
import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import { getPreferences, savePreferences } from "@/api/preferences";
import type { Units, UserPreference } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "./themed-text";

const OPTIONS: { label: string; value: Units }[] = [
  { label: "Imperial", value: "imperial" },
  { label: "Metric", value: "metric" },
];

export default function UnitsSetting() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const [prefs, setPrefs] = useState<UserPreference | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPreferences()
      .then((preference) => {
        if (cancelled) return;
        setPrefs(preference);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onChange = useCallback((value: Units) => {
    setPrefs((prev) => (prev ? { ...prev, units: value } : prev));
    setSaving(true);
    savePreferences({ units: value })
      .catch(() => {})
      .finally(() => setSaving(false));
  }, []);

  if (!loaded || !prefs) {
    return null;
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.neutral[200] }]}>
      <ThemedText type="captionSmall" style={{ color: colors.neutral[500] }}>
        {saving ? "Saving…" : "Weight and water amounts use these units."}
      </ThemedText>
      <View style={styles.segment}>
        {OPTIONS.map((option, index) => {
          const selected = prefs.units === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.segmentOption,
                {
                  backgroundColor: selected
                    ? colors.background
                    : "transparent",
                  borderColor: colors.neutral[300],
                  borderRightWidth:
                    index < OPTIONS.length - 1 ? 0 : 1,
                },
              ]}
              onPress={() => onChange(option.value)}
            >
              <ThemedText
                type="bodySmall"
                weight={selected ? "semiBold" : "regular"}
                style={{
                  color: selected ? colors.primary[700] : colors.neutral[600],
                }}
              >
                {option.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  segment: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
  },
});
