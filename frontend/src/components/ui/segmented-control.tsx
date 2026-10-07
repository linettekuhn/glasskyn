import { ComponentType } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "./themed-text";
import GlassSurface from "./glass-surface";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  LeftIconComponent?: ComponentType<any>;
  leftIconName?: string;
  RightIconComponent?: ComponentType<any>;
  rightIconName?: string;
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
    <View style={styles.track}>
      <View
        pointerEvents="none"
        style={[styles.baseline, { backgroundColor: colors.neutral[300] }]}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.segment,
              {
                borderBottomWidth: 1.5,
                borderBottomColor: selected
                  ? colors.secondary[700]
                  : "transparent",
              },
            ]}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
          >
            <View style={styles.content}>
              {option.LeftIconComponent && option.leftIconName && (
                <option.LeftIconComponent
                  name={option.leftIconName}
                  size={16}
                  color={selected ? colors.secondary[800] : colors.neutral[600]}
                />
              )}
              <ThemedText
                type="overline"
                weight={selected ? "bold" : "medium"}
                style={{
                  color: selected ? colors.secondary[800] : colors.neutral[600],
                }}
              >
                {option.label}
              </ThemedText>
              {option.RightIconComponent && option.rightIconName && (
                <option.RightIconComponent
                  name={option.rightIconName}
                  size={16}
                  color={selected ? colors.secondary[800] : colors.neutral[600]}
                />
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  baseline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 1.5,
  },
  segment: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
