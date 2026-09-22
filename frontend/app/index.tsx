import { Redirect } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useBoot } from "../src/contexts/BootContext";
import LoadingSpinner from "../src/components/ui/loading-spinner";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const { checkingOnboarding, needsOnboarding } = useBoot();

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
