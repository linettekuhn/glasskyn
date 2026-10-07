import { Pressable, StyleSheet, Vibration, View, useColorScheme } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";

interface StarRatingProps {
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  size?: number;
  disabled?: boolean;
}

export default function StarRating({
  value,
  onChange,
  label,
  size = 32,
  disabled = false,
}: StarRatingProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const filled = colors.tertiary[500];
  const outline = colors.neutral[400];

  const handlePress = (star: number) => {
    if (disabled) return;
    Vibration.vibrate(10);
    onChange(value === star ? null : star);
  };

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label ? `${label} rating` : "Rating"}
      accessibilityState={{ disabled }}
    >
      <View style={styles.row} accessibilityLabel={label}>
        {[1, 2, 3, 4, 5].map((star) => {
          const selected = value != null && star <= value;
          const starLabel = label
            ? `${label}, ${star} of 5 stars`
            : `${star} of 5 stars`;
          return (
            <Pressable
              key={star}
              onPress={() => handlePress(star)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={starLabel}
              accessibilityState={{ selected: value === star, disabled }}
              accessibilityHint={
                value === star ? "Double tap to clear rating" : undefined
              }
              hitSlop={12}
              style={styles.star}
            >
              <MaterialCommunityIcons
                name={selected ? "star" : "star-outline"}
                size={size}
                color={selected ? filled : outline}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  star: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
