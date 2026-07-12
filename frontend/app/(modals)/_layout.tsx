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
              presentation: "fullScreenModal",
            }}
          />
          <Stack.Screen
            name="browse-templates"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="template-preview"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="edit-template"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="product-picker"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="edit-routine"
            options={{
              headerShown: false,
            }}
          />
        </Stack>
      </TemplateProvider>
    </ScanProvider>
  );
}
