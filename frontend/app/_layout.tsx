import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/contexts/AuthContext";
import { ChatSessionProvider } from "../src/contexts/ChatSessionContext";
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
    "DM-Sans-Italic": require("../assets/fonts/DM_Sans/static/DMSans-Italic.ttf"),
    "DM-Sans-ThinItalic": require("../assets/fonts/DM_Sans/static/DMSans-ThinItalic.ttf"),
    "DM-Sans-ExtraLightItalic": require("../assets/fonts/DM_Sans/static/DMSans-ExtraLightItalic.ttf"),
    "DM-Sans-LightItalic": require("../assets/fonts/DM_Sans/static/DMSans-LightItalic.ttf"),
    "DM-Sans-MediumItalic": require("../assets/fonts/DM_Sans/static/DMSans-MediumItalic.ttf"),
    "DM-Sans-SemiBoldItalic": require("../assets/fonts/DM_Sans/static/DMSans-SemiBoldItalic.ttf"),
    "DM-Sans-BoldItalic": require("../assets/fonts/DM_Sans/static/DMSans-BoldItalic.ttf"),
    "DM-Sans-ExtraBoldItalic": require("../assets/fonts/DM_Sans/static/DMSans-ExtraBoldItalic.ttf"),
    "DM-Sans-BlackItalic": require("../assets/fonts/DM_Sans/static/DMSans-BlackItalic.ttf"),
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
          <ChatSessionProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(main)" />
            </Stack>
            <Toast />
          </ChatSessionProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
