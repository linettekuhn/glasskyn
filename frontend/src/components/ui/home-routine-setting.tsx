import { useEffect, useState, useCallback } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { listRoutines, localToday } from "@/api/routines";
import { getPreferences, savePreferences } from "@/api/preferences";
import type { Routine, UserPreference } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "./themed-text";
import ThemedDropdown, { type DropdownOption } from "./themed-dropdown";

const AUTOMATIC_VALUE = "";

export default function HomeRoutineSetting() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [prefs, setPrefs] = useState<UserPreference | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listRoutines("skincare", localToday()), getPreferences()])
      .then(([routineList, preference]) => {
        if (cancelled) return;
        setRoutines(routineList);
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

  const options: DropdownOption[] = [
    { label: "Automatic (active)", value: AUTOMATIC_VALUE },
    ...routines.map((r) => ({ label: r.name, value: String(r.id) })),
  ];

  const selectedValue =
    prefs?.home_routine_id != null &&
    routines.some((r) => r.id === prefs.home_routine_id)
      ? String(prefs.home_routine_id)
      : AUTOMATIC_VALUE;

  const onChange = useCallback((value: string) => {
    const next = value === AUTOMATIC_VALUE ? null : Number(value);
    setPrefs((prev) => (prev ? { ...prev, home_routine_id: next } : prev));
    setSaving(true);
    savePreferences({ home_routine_id: next })
      .catch(() => {})
      .finally(() => setSaving(false));
  }, []);

  if (!loaded || routines.length === 0) {
    return null;
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.neutral[200] }]}>
      <ThemedText type="captionSmall" style={{ color: colors.neutral[500] }}>
        {saving ? "Saving…" : "Choose which routine shows on the status card."}
      </ThemedText>
      <ThemedDropdown
        options={options}
        value={selectedValue}
        onChange={onChange}
        placeholder="Select a routine"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
});
