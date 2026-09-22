import { ReactNode } from "react";
import { View, ScrollView, StyleSheet, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "./themed-text";
import Divider from "./divider";
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
      style={styles.container}
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
        <Divider>
          <ThemedText
            type="overline"
            style={{ paddingHorizontal: 16, color: colors.neutral[600] }}
          >
            step {currentStep} of 3
          </ThemedText>
        </Divider>
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
    paddingHorizontal: 20,
    gap: 16,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
