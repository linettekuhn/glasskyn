import { useState } from "react";
import { View, StyleSheet, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedButton from "@/components/ui/themed-button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import OnboardingStep from "@/components/ui/onboarding-step";

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
  const { state, setGoals } = useOnboarding();
  const [selected, setSelected] = useState<string[]>(state.goals);

  const toggle = (goal: string) => {
    setSelected((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
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
    <OnboardingStep currentStep={3}>
      <View style={styles.header}>
        <ThemedText type="h1">What are you hoping to achieve?</ThemedText>
        <ThemedText type="bodyLarge" style={{ color: colors.neutral[600] }}>
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
              color={colors.primary[400]}
              alignment="center"
            />
          );
        })}
      </View>

      <View style={{ gap: 8 }}>
        <ThemedButton
          text="Finish Setup"
          onPress={handleFinish}
          color={colors.primary[600]}
        />
        <ThemedButton
          link
          text="Skip for now"
          onPress={handleSkip}
          color={colors.neutral[800]}
        />
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
