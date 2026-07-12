import { Colors, getTheme } from "@/constants/theme";
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AuthLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="register" options={{ gestureEnabled: false }} />
      </Stack>
    </SafeAreaView>
  );
}
