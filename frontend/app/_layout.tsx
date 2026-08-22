import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { BootProvider, useBoot } from "../src/contexts/BootContext";
import { ChatSessionProvider } from "../src/contexts/ChatSessionContext";
import { VersionCheckProvider, useVersionCheck } from "../src/contexts/VersionCheckContext";
import { Colors, getTheme } from "../src/constants/theme";
import { useFonts } from "expo-font";
import Toast from "react-native-toast-message";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import LoadingSpinner from "../src/components/ui/loading-spinner";
import ForceUpdateModal from "../src/components/ui/force-update-modal";

SplashScreen.preventAutoHideAsync().catch(() => {});

const SPLASH_FAILSAFE_MS = 10000;

function AppContent() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
  const { isLoading, needsUpdate, storeUrl } = useVersionCheck();
  const { isLoading: authLoading } = useAuth();
  const { checkingOnboarding } = useBoot();

  const bootReady =
    !isLoading && !authLoading && !checkingOnboarding;

  useEffect(() => {
    if (!bootReady) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [bootReady]);

  useEffect(() => {
    const failsafe = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, SPLASH_FAILSAFE_MS);
    return () => clearTimeout(failsafe);
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (needsUpdate && storeUrl) {
    return <ForceUpdateModal storeUrl={storeUrl} />;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(main)" />
      </Stack>
      <Toast />
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];
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
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <SafeAreaProvider>
        <AuthProvider>
          <ChatSessionProvider>
            <VersionCheckProvider>
              <BootProvider>
                <AppContent />
              </BootProvider>
            </VersionCheckProvider>
          </ChatSessionProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
