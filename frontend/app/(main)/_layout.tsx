import { Stack } from "expo-router";

export default function MainLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "My Products" }} />
      <Stack.Screen
        name="add-product"
        options={{ title: "Add Product", presentation: "modal" }}
      />
    </Stack>
  );
}
