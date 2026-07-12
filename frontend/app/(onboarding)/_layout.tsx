import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { useColorScheme } from "react-native";
import { Colors, getTheme } from "@/constants/theme";

export default function OnboardingLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
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
