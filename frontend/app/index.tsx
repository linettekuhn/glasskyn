import { useState, useEffect } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { getSkinProfile } from "../src/api/routines";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      setCheckingOnboarding(false);
      return;
    }

    (async () => {
      try {
        await getSkinProfile();
        setNeedsOnboarding(false);
      } catch {
        setNeedsOnboarding(true);
      } finally {
        setCheckingOnboarding(false);
      }
    })();
  }, [isAuthenticated, isLoading]);

  if (isLoading || checkingOnboarding) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isAuthenticated) {
    if (needsOnboarding) {
      return <Redirect href="/(onboarding)/welcome" />;
    }
    return <Redirect href={"/(main)"} />;
  }

  return <Redirect href="/(auth)/login" />;
}
