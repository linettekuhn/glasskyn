import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { OnboardingProvider } from "@/contexts/OnboardingContext";

export default function OnboardingLayout() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <OnboardingProvider>
        <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="skin-type" />
          <Stack.Screen name="concerns" />
          <Stack.Screen name="goals" />
          <Stack.Screen name="complete" />
        </Stack>
      </OnboardingProvider>
    </SafeAreaView>
  );
}
