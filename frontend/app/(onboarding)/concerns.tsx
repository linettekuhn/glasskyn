import { useState } from "react";
import { View, StyleSheet, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedButton from "@/components/ui/themed-button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import OnboardingStep from "@/components/ui/onboarding-step";

const CONCERNS = [
  "Acne",
  "Aging",
  "Dark Spots",
  "Redness",
  "Enlarged Pores",
  "Dryness",
  "Oiliness",
  "Dullness",
];

export default function ConcernsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const router = useRouter();
  const { state, setConcerns } = useOnboarding();
  const [selected, setSelected] = useState<string[]>(state.concerns);

  const toggle = (concern: string) => {
    setSelected((prev) =>
      prev.includes(concern)
        ? prev.filter((c) => c !== concern)
        : [...prev, concern],
    );
  };

  const handleContinue = () => {
    setConcerns(selected);
    router.push("/(onboarding)/goals");
  };

  const handleSkip = () => {
    setConcerns([]);
    router.push("/(onboarding)/goals");
  };

  return (
    <OnboardingStep currentStep={2}>
      <View style={styles.header}>
        <ThemedText type="h1">Any concerns you're focused on?</ThemedText>
        <ThemedText type="bodyLarge" style={{ color: colors.neutral[600] }}>
          Select as many as apply. This helps us flag ingredients that matter to
          you.
        </ThemedText>
      </View>

      <View style={styles.chipGrid}>
        {CONCERNS.map((concern) => {
          const active = selected.includes(concern);
          return (
            <ThemedButton
              key={concern}
              text={concern}
              outlined={!active}
              onPress={() => toggle(concern)}
              color={colors.primary[400]}
              alignment="center"
            />
          );
        })}
      </View>

      <View style={{ gap: 8 }}>
        <ThemedButton
          text="Continue"
          onPress={handleContinue}
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
