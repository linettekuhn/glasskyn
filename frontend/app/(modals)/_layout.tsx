import { Stack } from "expo-router";

export default function ModalLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: "modal",
        headerShown: true,
        headerTitle: "",
        headerTintColor: "#6c63ff",
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="add-product" options={{ headerShown: false }} />
    </Stack>
  );
}