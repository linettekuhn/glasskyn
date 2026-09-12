import { StyleSheet, TouchableOpacity, useColorScheme } from "react-native";
import { ThemedText } from "./themed-text";
import { Colors, getTheme } from "@/constants/theme";
import tinyColor from "tinycolor2";

type ChipProps = {
  label: string;
  onPress: () => void;
  active?: boolean;
  activeColor?: string;
  muted?: boolean;
  disabled?: boolean;
};

export default function Chip({
  label,
  onPress,
  active = false,
  activeColor,
  muted = false,
  disabled = false,
}: ChipProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const c = activeColor ?? colors.primary[500];
  const bgColor = active ? c : muted ? colors.neutral[200] : colors.background;
  const tiny = tinyColor(bgColor);
  const txtColor =
    active || muted
      ? tiny.isDark()
        ? colors.neutral[100]
        : colors.neutral[900]
      : colors.text;

  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={[
        styles.chip,
        {
          backgroundColor: bgColor,
          borderColor: active ? c : colors.neutral[300],
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <ThemedText
        type="bodySmall"
        weight="medium"
        style={{ color: txtColor }}
        numberOfLines={1}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    alignItems: "center",
  },
});