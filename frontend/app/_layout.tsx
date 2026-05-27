import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/contexts/AuthContext";
import { useFonts } from "expo-font";
import Toast from "react-native-toast-message";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "DM-Sans": require("../assets/fonts/DM_Sans/static/DMSans-Regular.ttf"),
    "DM-Sans-Thin": require("../assets/fonts/DM_Sans/static/DMSans-Thin.ttf"),
    "DM-Sans-ExtraLight": require("../assets/fonts/DM_Sans/static/DMSans-ExtraLight.ttf"),
    "DM-Sans-Light": require("../assets/fonts/DM_Sans/static/DMSans-Light.ttf"),
    "DM-Sans-Medium": require("../assets/fonts/DM_Sans/static/DMSans-Medium.ttf"),
    "DM-Sans-SemiBold": require("../assets/fonts/DM_Sans/static/DMSans-SemiBold.ttf"),
    "DM-Sans-Bold": require("../assets/fonts/DM_Sans/static/DMSans-Bold.ttf"),
    "DM-Sans-ExtraBold": require("../assets/fonts/DM_Sans/static/DMSans-ExtraBold.ttf"),
    "DM-Sans-Black": require("../assets/fonts/DM_Sans/static/DMSans-Black.ttf"),
    "DM-Serif-Display": require("../assets/fonts/DM_Serif_Display/DMSerifDisplay-Regular.ttf"),
    "DM-Serif-Display-Italic": require("../assets/fonts/DM_Serif_Display/DMSerifDisplay-Italic.ttf"),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}
