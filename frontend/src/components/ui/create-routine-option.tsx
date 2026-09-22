import {
  View,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { Colors, getTheme } from "@/constants/theme";
import GlassSurface, { withAlpha } from "./glass-surface";
import type { CreateRoutineOption } from "@/constants/routine";
import { ThemedText } from "./themed-text";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface CreateRoutineOptionProps {
  option: CreateRoutineOption;
  onPress: () => void;
  iconSize?: number;
  chevronSize?: number;
  style?: object;
}

export default function CreateRoutineOptionRow({
  option,
  onPress,
  iconSize = 24,
  chevronSize = 20,
  style,
}: CreateRoutineOptionProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  return (
    <GlassSurface style={[styles.option, style]} onPress={onPress}>
      <View
        style={[styles.optionIcon, { backgroundColor: colors.primary[100] }]}
      >
        <MaterialCommunityIcons
          name={option.icon}
          size={iconSize}
          color={colors.primary[600]}
        />
      </View>
      <View style={styles.optionText}>
        <ThemedText type="bodyLarge" weight="semiBold">
          {option.title}
        </ThemedText>
        <ThemedText type="bodySmall" style={{ color: colors.neutral[700] }}>
          {option.subtitle}
        </ThemedText>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={chevronSize}
        color={colors.neutral[500]}
      />
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 8,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
});
