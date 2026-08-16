import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { StyleSheet, useColorScheme } from "react-native";
import { getPreferences, savePreferences } from "@/api/preferences";
import type { Routine, UserPreference } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "./themed-text";
import ThemedDropdown, { type DropdownOption } from "./themed-dropdown";
import GlassSurface from "./glass-surface";

const AUTOMATIC_VALUE = "";

type HomeRoutineSettingProps = {
  routines: Routine[];
};

export default function HomeRoutineSetting({ routines }: HomeRoutineSettingProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const [prefs, setPrefs] = useState<UserPreference | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchPreferences = useCallback(async () => {
    try {
      const preference = await getPreferences();
      setPrefs(preference);
    } catch {
      // keep existing data on background refresh errors
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPreferences();
    }, [fetchPreferences]),
  );

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

  if (!loaded) {
    return (
      <GlassSurface style={styles.card}>
        <ThemedText type="captionSmall" style={{ color: colors.neutral[500] }}>
          Loading…
        </ThemedText>
      </GlassSurface>
    );
  }

  if (routines.length === 0) {
    return null;
  }

  return (
    <GlassSurface style={styles.card}>
      <ThemedText type="captionSmall" style={{ color: colors.neutral[500] }}>
        {saving ? "Saving…" : "Choose which routine shows on the status card."}
      </ThemedText>
      <ThemedDropdown
        options={options}
        value={selectedValue}
        onChange={onChange}
        placeholder="Select a routine"
      />
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
  },
});
