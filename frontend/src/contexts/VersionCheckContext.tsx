import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { checkAppVersion, VersionCheckResponse } from "../api/version";

interface VersionCheckState {
  isLoading: boolean;
  needsUpdate: boolean;
  storeUrl: string | null;
}

const VersionCheckContext = createContext<VersionCheckState>({
  isLoading: true,
  needsUpdate: false,
  storeUrl: null,
});

export function useVersionCheck() {
  return useContext(VersionCheckContext);
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

function getNativeVersion(): string {
  if (Platform.OS === "ios") {
    return Application.nativeApplicationVersion ?? "1.0.0";
  }
  if (Platform.OS === "android") {
    return Application.nativeApplicationVersion ?? "1.0.0";
  }
  return "1.0.0";
}

export function VersionCheckProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VersionCheckState>({
    isLoading: true,
    needsUpdate: false,
    storeUrl: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res: VersionCheckResponse = await checkAppVersion();
        if (cancelled) return;

        const deviceVersion = getNativeVersion();
        const needsUpdate = compareVersions(deviceVersion, res.minimum_version) < 0;

        setState({ isLoading: false, needsUpdate, storeUrl: res.store_url });
      } catch {
        if (!cancelled) {
          setState({ isLoading: false, needsUpdate: false, storeUrl: null });
        }
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  return (
    <VersionCheckContext.Provider value={state}>
      {children}
    </VersionCheckContext.Provider>
  );
}
