import { Stack } from "expo-router";
import { OnboardingProvider } from "@/contexts/OnboardingContext";

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="skin-type" />
        <Stack.Screen name="concerns" />
        <Stack.Screen name="goals" />
        <Stack.Screen name="complete" />
      </Stack>
    </OnboardingProvider>
  );
}
