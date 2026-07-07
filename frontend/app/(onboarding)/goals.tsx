import { useState } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedButton from "@/components/ui/themed-button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const GOALS = [
  "Hydration",
  "Brightening",
  "Anti-Aging",
  "Barrier Repair",
  "Soothing",
  "Mattifying",
  "Even Tone",
  "Firming",
];

export default function GoalsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const router = useRouter();
  const { state, setGoals, reset } = useOnboarding();
  const [selected, setSelected] = useState<string[]>(state.goals);

  const toggle = (goal: string) => {
    setSelected((prev) =>
      prev.includes(goal)
        ? prev.filter((g) => g !== goal)
        : [...prev, goal]
    );
  };

  const handleFinish = () => {
    setGoals(selected);
    router.push("/(onboarding)/complete");
  };

  const handleSkip = () => {
    setGoals([]);
    router.push("/(onboarding)/complete");
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      contentContainerStyle={styles.content}
    >
      <TouchableOpacity onPress={() => router.back()} style={{ alignSelf: "flex-start" }}>
        <MaterialCommunityIcons name="chevron-left" size={28} color={colors.neutral[700]} />
      </TouchableOpacity>
      <View style={styles.header}>
        <ThemedText type="h1">What are you hoping to achieve?</ThemedText>
        <ThemedText
          type="bodyLarge"
          style={{ color: colors.secondary[600] }}
        >
          Choose your goals and we'll tailor routine suggestions around them.
        </ThemedText>
      </View>

      <View style={styles.chipGrid}>
        {GOALS.map((goal) => {
          const active = selected.includes(goal);
          return (
            <ThemedButton
              key={goal}
              text={goal}
              outlined={!active}
              onPress={() => toggle(goal)}
              color={colors.primary[500]}
              alignment="center"
            />
          );
        })}
      </View>

      <View style={styles.footer}>
        <ThemedButton text="Finish Setup" onPress={handleFinish} />
        <ThemedButton
          link
          text="Skip for now"
          onPress={handleSkip}
          color={colors.neutral[700]}
        />
        <ThemedText type="caption" style={{ color: colors.neutral[700], textAlign: "center" }}>
          Step 3 of 3
        </ThemedText>
      </View>

      <ThemedButton
        link
        text="Reset"
        onPress={() => { reset(); router.replace("/(onboarding)/welcome"); }}
        color={colors.neutral[700]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 32,
  },
  header: {
    gap: 8,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  footer: {
    gap: 12,
  },
});
