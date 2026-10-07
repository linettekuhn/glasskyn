import { StyleSheet, View, useColorScheme } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";

export type EntryStepKey = "capture" | "mark" | "review";

const STEPS: Array<{
  key: EntryStepKey;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  title: string;
}> = [
  { key: "capture", icon: "camera", title: "Capture" },
  { key: "mark", icon: "pencil-circle", title: "Mark and label" },
  { key: "review", icon: "star", title: "Review" },
];

interface EntryStepsProps {
  active: EntryStepKey;
}

export default function EntrySteps({ active }: EntryStepsProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const activeIndex = STEPS.findIndex((s) => s.key === active);

  return (
    <View
      style={styles.steps}
      accessibilityRole="list"
      accessibilityLabel={`Step ${activeIndex + 1} of 3: ${STEPS[activeIndex]?.title}`}
    >
      <View
        pointerEvents="none"
        style={[styles.line, { backgroundColor: colors.tertiary[200] }]}
      />
      {STEPS.map((step, index) => {
        const isActive = step.key === active;
        const isDone = index < activeIndex;
        const color = isActive
          ? colors.tertiary[500]
          : isDone
            ? colors.tertiary[700]
            : colors.neutral[400];
        const textColor = isActive
          ? colors.tertiary[900]
          : colors.neutral[500];
        return (
          <View
            key={step.key}
            style={styles.step}
            accessibilityRole="listitem"
            accessibilityLabel={`${step.title}${isActive ? ", current step" : ""}`}
            accessibilityState={{ selected: isActive }}
          >
            <MaterialCommunityIcons
              name={step.icon}
              size={22}
              color={color}
            />
            <ThemedText
              type="captionSmall"
              weight={isActive ? "bold" : "regular"}
              style={{ color: textColor, textAlign: "center" }}
            >
              {step.title}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  steps: {
    flexDirection: "row",
    alignSelf: "stretch",
    marginVertical: 8,
  },
  line: {
    position: "absolute",
    top: 11,
    left: 24,
    right: 24,
    height: 1.5,
  },
  step: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
});
