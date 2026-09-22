import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { getSkinProfile } from "../api/routines";

interface BootState {
  checkingOnboarding: boolean;
  needsOnboarding: boolean | null;
}

const BootContext = createContext<BootState>({
  checkingOnboarding: true,
  needsOnboarding: null,
});

export function useBoot() {
  const context = useContext(BootContext);
  if (!context) {
    throw new Error("useBoot must be used within a BootProvider");
  }
  return context;
}

export function BootProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setNeedsOnboarding(null);
      setCheckingOnboarding(false);
      return;
    }

    let cancelled = false;
    setCheckingOnboarding(true);

    (async () => {
      try {
        await getSkinProfile();
        if (!cancelled) setNeedsOnboarding(false);
      } catch {
        if (!cancelled) setNeedsOnboarding(true);
      } finally {
        if (!cancelled) setCheckingOnboarding(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <BootContext.Provider value={{ checkingOnboarding, needsOnboarding }}>
      {children}
    </BootContext.Provider>
  );
}
