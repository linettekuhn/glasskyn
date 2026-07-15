import { Stack } from "expo-router";
import { ScanProvider } from "../../src/contexts/ScanContext";
import { TemplateProvider } from "../../src/contexts/TemplateContext";

export default function ModalLayout() {
  return (
    <ScanProvider>
      <TemplateProvider>
        <Stack
          screenOptions={{
            presentation: "modal",
            headerShown: false,
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
              contentStyle: { backgroundColor: "#fff" },
            }}
          />
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
          <Stack.Screen name="edit-routine" />
        </Stack>
      </TemplateProvider>
    </ScanProvider>
  );
}
