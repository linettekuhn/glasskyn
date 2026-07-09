import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ScanProvider } from "../../src/contexts/ScanContext";

export default function ModalLayout() {
  return (
    <SafeAreaProvider>
      <ScanProvider>
        <Stack
          screenOptions={{
            presentation: "modal",
            headerShown: true,
            headerTitle: "",
            headerTintColor: "#6c63ff",
            headerBackTitle: "Back",
            headerStyle: {
              backgroundColor: "#fff",
            },
            headerShadowVisible: false,
            gestureEnabled: true,
            gestureDirection: "vertical",
          }}
        >
          <Stack.Screen
            name="add-product"
            options={{
              headerShown: false,
              contentStyle: { backgroundColor: "#fff" },
            }}
          />
          <Stack.Screen
            name="scan"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="browse-templates"
            options={{
              headerShown: false,
            }}
          />
        </Stack>
      </ScanProvider>
    </SafeAreaProvider>
  );
}
