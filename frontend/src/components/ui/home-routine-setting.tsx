import { useEffect, useState, useCallback } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { setMainRoutine } from "@/api/routines";
import type { Routine } from "@/types";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "./themed-text";
import ThemedDropdown, { type DropdownOption } from "./themed-dropdown";
import GlassSurface from "./glass-surface";

const AUTOMATIC_VALUE = "";

type HomeRoutineSettingProps = {
  routines: Routine[];
};

export default function HomeRoutineSetting({
  routines,
}: HomeRoutineSettingProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const [saving, setSaving] = useState(false);
  const [mainRoutineId, setMainRoutineId] = useState<number | null | undefined>(
    undefined,
  );

  useEffect(() => {
    setMainRoutineId(routines.find((r) => r.is_main_routine)?.id ?? null);
  }, [routines]);

  const mainId =
    mainRoutineId ?? routines.find((r) => r.is_main_routine)?.id ?? null;

  const options: DropdownOption[] = [
    { label: "Automatic (latest created)", value: AUTOMATIC_VALUE },
    ...routines.map((r) => ({ label: r.name, value: String(r.id) })),
  ];

  const selectedValue = mainId == null ? AUTOMATIC_VALUE : String(mainId);

  const onChange = useCallback((value: string) => {
    const next = value === AUTOMATIC_VALUE ? null : Number(value);
    setMainRoutineId(next);
    setSaving(true);
    setMainRoutine(next)
      .catch(() => {})
      .finally(() => setSaving(false));
  }, []);

  return (
    <GlassSurface style={styles.card}>
      <ThemedText type="captionSmall" style={{ color: colors.neutral[500] }}>
        {saving ? "Saving…" : "Choose which routine is your main routine."}
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
