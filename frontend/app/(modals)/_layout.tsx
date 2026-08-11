import { Stack } from "expo-router";
import { ScanProvider } from "../../src/contexts/ScanContext";
import { TemplateProvider } from "../../src/contexts/TemplateContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { Colors, getTheme } from "@/constants/theme";

export default function ModalLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScanProvider>
        <TemplateProvider>
          <Stack
            screenOptions={{
              presentation: "modal",
              headerShown: false,
              headerTitle: "",
              headerTintColor: "#6c63ff",
              headerBackTitle: "Back",
              headerShadowVisible: false,
              gestureEnabled: true,
              gestureDirection: "vertical",
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="add-product" />
            <Stack.Screen
              name="scan"
              options={{
                presentation: "fullScreenModal",
              }}
            />
            <Stack.Screen name="browse-templates" />
            <Stack.Screen name="template-preview" />
            <Stack.Screen name="edit-template" />
            <Stack.Screen name="product-picker" />
            <Stack.Screen name="routine-manual" />
            <Stack.Screen name="add-step" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="edit-routine" />
            <Stack.Screen name="edit-account" />
            <Stack.Screen name="change-password" />
            <Stack.Screen name="edit-skin-profile" />
            <Stack.Screen name="product-detail" />
            <Stack.Screen name="expiring-products" />
          </Stack>
        </TemplateProvider>
      </ScanProvider>
    </SafeAreaView>
  );
}
