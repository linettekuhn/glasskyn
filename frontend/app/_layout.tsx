import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/contexts/AuthContext";
import { useFonts } from "expo-font";
import Toast from "react-native-toast-message";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "DM-Sans": require("../assets/fonts/DM_Sans/DMSans-VariableFont_opsz,wght.ttf"),
    "DM-Serif-Display": require("../assets/fonts/DM_Serif_Display/DMSerifDisplay-Regular.ttf"),
    "DM-Serif-Display-Italic": require("../assets/fonts/DM_Serif_Display/DMSerifDisplay-Italic.ttf"),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(main)" />
        </Stack>
        <Toast />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
