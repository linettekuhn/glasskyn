import { ReactNode } from "react";
import { View, ScrollView, StyleSheet, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "./themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedButton from "./themed-button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";

interface OnboardingStepProps {
  children: ReactNode;
  currentStep?: number;
  showStepIndicator?: boolean;
}

export default function OnboardingStep({
  children,
  currentStep,
  showStepIndicator = true,
}: OnboardingStepProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const router = useRouter();
  const { reset } = useOnboarding();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.neutral[100] }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.controls}>
        <ThemedButton
          link
          textType="captionLarge"
          text="Back"
          onPress={() => router.back()}
          leftIconName="arrow-back"
          LeftIconComponent={MaterialIcons}
          color={colors.neutral[600]}
        />
        <ThemedButton
          link
          textType="captionLarge"
          text="Reset"
          onPress={() => {
            reset();
            router.replace("/(onboarding)/welcome");
          }}
          leftIconName="reload"
          LeftIconComponent={MaterialCommunityIcons}
          color={colors.neutral[600]}
        />
      </View>

      {showStepIndicator && currentStep && (
        <View style={styles.divider}>
          <View
            style={[styles.line, { backgroundColor: colors.neutral[300] }]}
          />
          <ThemedText
            type="overline"
            style={{ paddingHorizontal: 16, color: colors.neutral[600] }}
          >
            step {currentStep} of 3
          </ThemedText>
          <View
            style={[styles.line, { backgroundColor: colors.neutral[300] }]}
          />
        </View>
      )}

      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 48,
    paddingHorizontal: 20,
    gap: 16,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  line: {
    flex: 1,
    height: 1,
  },
});
