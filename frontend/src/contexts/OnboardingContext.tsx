import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface OnboardingState {
  skinType: string | null;
  isSensitive: boolean | null;
  concerns: string[];
  goals: string[];
}

interface OnboardingContextType {
  state: OnboardingState;
  setSkinType: (val: string) => void;
  setIsSensitive: (val: boolean | null) => void;
  setConcerns: (val: string[]) => void;
  setGoals: (val: string[]) => void;
  reset: () => void;
}

const initialState: OnboardingState = {
  skinType: null,
  isSensitive: null,
  concerns: [],
  goals: [],
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(initialState);

  const setSkinType = useCallback((val: string) => {
    setState((prev) => ({ ...prev, skinType: val }));
  }, []);

  const setIsSensitive = useCallback((val: boolean | null) => {
    setState((prev) => ({ ...prev, isSensitive: val }));
  }, []);

  const setConcerns = useCallback((val: string[]) => {
    setState((prev) => ({ ...prev, concerns: val }));
  }, []);

  const setGoals = useCallback((val: string[]) => {
    setState((prev) => ({ ...prev, goals: val }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <OnboardingContext.Provider value={{ state, setSkinType, setIsSensitive, setConcerns, setGoals, reset }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
