import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientBackground from "@/components/ui/gradient-background";

export default function AuthLayout() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <GradientBackground />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="register" options={{ gestureEnabled: false }} />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
      </Stack>
    </SafeAreaView>
  );
}
