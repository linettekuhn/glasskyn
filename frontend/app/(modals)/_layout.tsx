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
          name="scan-front"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="scan-back"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="scan-pao"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="scan-manual-pao"
          options={{
            headerTitle: "PAO Value",
            contentStyle: { backgroundColor: "#fff" },
          }}
        />
        <Stack.Screen
          name="scan-confirm"
          options={{
            headerTitle: "Confirm Scan",
            contentStyle: { backgroundColor: "#fff" },
          }}
        />
      </Stack>
      </ScanProvider>
    </SafeAreaProvider>
  );
}