import { useState } from "react";
import {
  View,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ui/themed-text";
import { Colors, getTheme } from "@/constants/theme";
import ThemedButton from "@/components/ui/themed-button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { upsertSkinProfile } from "@/api/routines";
import Toast from "react-native-toast-message";
import OnboardingStep from "@/components/ui/onboarding-step";

export default function CompleteScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const router = useRouter();
  const { state, reset } = useOnboarding();
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await upsertSkinProfile({
        skin_type: state.skinType ?? undefined,
        is_sensitive: state.isSensitive ?? undefined,
        concerns: state.concerns,
        goals: state.goals,
      });
      reset();
    } catch {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to save your profile",
      });
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  const handleSeeRoutine = async () => {
    await saveProfile();
    router.replace("/(main)/routine");
  };

  const handleScanProduct = async () => {
    await saveProfile();
    router.replace("/(main)/scanner");
  };

  return (
    <OnboardingStep showStepIndicator={false}>
      <View style={styles.heading}>
        <ThemedText type="h1" style={{ textAlign: "center" }}>
          Your routine is ready
        </ThemedText>
        <ThemedText
          type="bodyLarge"
          style={{ textAlign: "center", color: colors.neutral[600] }}
        >
          Based on your skin, here's where to start. Scan your own products
          anytime to personalize it further.
        </ThemedText>
      </View>

      {saving ? (
        <ActivityIndicator size="large" color={colors.neutral[700]} />
      ) : (
        <View style={styles.actions}>
          <ThemedButton text="See My Routine" onPress={handleSeeRoutine} />
          <ThemedButton
            link
            text="Scan a Product"
            onPress={handleScanProduct}
            color={colors.secondary[700]}
          />
        </View>
      )}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: 16,
  },
  actions: {
    gap: 16,
  },
});
