import { Redirect } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href={"/(main)"} />;
  }

  return <Redirect href="/(auth)/login" />;
}
