import { useState, useEffect } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { getSkinProfile } from "../src/api/routines";
import LoadingSpinner from "../src/components/ui/loading-spinner";

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
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    if (needsOnboarding) {
      return <Redirect href="/(onboarding)/welcome" />;
    }
    return <Redirect href={"/(main)"} />;
  }

  return <Redirect href="/(auth)/login" />;
}
