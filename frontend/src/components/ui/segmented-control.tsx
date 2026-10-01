import {
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "./themed-text";
import GlassSurface from "./glass-surface";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  return (
    <GlassSurface style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.segment,
              {
                backgroundColor: selected
                  ? colors.secondary[300]
                  : "transparent",
              },
            ]}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
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
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    overflow: "hidden",
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
});
