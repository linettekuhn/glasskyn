import { StyleSheet, View, useColorScheme } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, getTheme } from "@/constants/theme";
import { ThemedText } from "@/components/ui/themed-text";
import ThemedButton from "@/components/ui/themed-button";

interface CheckInCTAProps {
  /** Compact renders the demoted link-style button shown under today's card. */
  compact?: boolean;
  onPress: () => void;
}

const NODE_SIZE = 48;
const LINE_HEIGHT = 1.5;

const ENTRY_STEPS = [
  {
    icon: "camera",
    title: "Capture",
    description: "Take a guided smart selfie",
  },
  {
    icon: "pencil-circle",
    title: "Mark & label",
    description: "Circle and name your concerns",
  },
  {
    icon: "star",
    title: "Review",
    description: "Rate moisture, texture, and tone",
  },
] as const;

/**
 * Primary journal entry call to action. Large variant owns the card area when
 * today has no entry; compact variant sits under today's card once an
 * entry exists (multiple sessions per day are supported).
 */
export default function CheckInCTA({
  compact = false,
  onPress,
}: CheckInCTAProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <ThemedButton
          text="Add another entry for today"
          onPress={onPress}
          link
          textType="bodySmall"
          color={colors.secondary[600]}
        />
      </View>
    );
  }

  return (
    <View style={styles.emptyState}>
      <ThemedText type="h2" style={styles.centered}>
        Start today's journal entry
      </ThemedText>
      <ThemedText
        type="body"
        style={{ color: colors.neutral[600], ...styles.centered }}
      >
        Each entry adds a page to your skin story
      </ThemedText>

      <View style={styles.steps}>
        <View
          pointerEvents="none"
          style={[styles.line, { backgroundColor: colors.tertiary[200] }]}
        />
        {ENTRY_STEPS.map((step) => (
          <View key={step.title} style={styles.step}>
            <MaterialCommunityIcons
              name={step.icon}
              size={28}
              color={colors.tertiary[500]}
            />
            <ThemedText
              type="bodySmall"
              weight="bold"
              style={{ color: colors.tertiary[900] }}
            >
              {step.title}
            </ThemedText>
            <ThemedText
              type="captionSmall"
              style={[styles.centered, { color: colors.tertiary[800] }]}
            >
              {step.description}
            </ThemedText>
          </View>
        ))}
      </View>

      <ThemedButton
        text="New entry"
        onPress={onPress}
        LeftIconComponent={MaterialCommunityIcons}
        leftIconName="camera-plus-outline"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    gap: 12,
    paddingHorizontal: 32,
    paddingTop: 24,
    alignItems: "center",
  },
  centered: {
    textAlign: "center",
    alignSelf: "center",
  },
  steps: {
    flexDirection: "row",
    alignSelf: "stretch",
    marginVertical: 12,
  },
  line: {
    position: "absolute",
    top: NODE_SIZE / 3 - LINE_HEIGHT / 2,
    left: 0,
    right: 0,
    height: LINE_HEIGHT,
  },
  step: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  compactWrap: {
    paddingTop: 12,
    alignItems: "center",
  },
});
