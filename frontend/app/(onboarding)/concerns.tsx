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
  const { state, setConcerns, reset } = useOnboarding();
  const [selected, setSelected] = useState<string[]>(state.concerns);

  const toggle = (concern: string) => {
    setSelected((prev) =>
      prev.includes(concern)
        ? prev.filter((c) => c !== concern)
        : [...prev, concern]
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
    <ScrollView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      contentContainerStyle={styles.content}
    >
      <TouchableOpacity onPress={() => router.back()} style={{ alignSelf: "flex-start" }}>
        <MaterialCommunityIcons name="chevron-left" size={28} color={colors.neutral[700]} />
      </TouchableOpacity>
      <View style={styles.header}>
        <ThemedText type="h1">Any concerns you're focused on?</ThemedText>
        <ThemedText
          type="bodyLarge"
          style={{ color: colors.secondary[600] }}
        >
          Select as many as apply. This helps us flag ingredients that matter to you.
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
              color={colors.primary[500]}
              alignment="center"
            />
          );
        })}
      </View>

      <View style={styles.footer}>
        <ThemedButton text="Continue" onPress={handleContinue} />
        <ThemedButton
          link
          text="Skip for now"
          onPress={handleSkip}
          color={colors.neutral[700]}
        />
        <ThemedText type="caption" style={{ color: colors.neutral[700], textAlign: "center" }}>
          Step 2 of 3
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
