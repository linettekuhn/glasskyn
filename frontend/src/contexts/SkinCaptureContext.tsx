import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface SkinLandmarkRefs {
  [key: string]: { x: number; y: number } | undefined;
}

export interface SkinPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface SkinCaptureDraft {
  photoPath: string;
  photoUri: string;
  capturedAt: string;
  landmarks: SkinLandmarkRefs | null;
  pose: SkinPose | null;
  /** Normalized preview size the landmark refs were captured against. */
  frameSize: { width: number; height: number } | null;
  luma: number | null;
  variance: number | null;
}

interface SkinCaptureContextType {
  draft: SkinCaptureDraft | null;
  setDraft: (draft: SkinCaptureDraft | null) => void;
}

const SkinCaptureContext = createContext<SkinCaptureContextType | null>(null);

export function SkinCaptureProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<SkinCaptureDraft | null>(null);

  const setDraft = useCallback((next: SkinCaptureDraft | null) => {
    setDraftState(next);
  }, []);

  const value = useMemo(
    () => ({ draft, setDraft }),
    [draft, setDraft],
  );

  return (
    <SkinCaptureContext.Provider value={value}>
      {children}
    </SkinCaptureContext.Provider>
  );
}

export function useSkinCapture(): SkinCaptureContextType {
  const ctx = useContext(SkinCaptureContext);
  if (!ctx) {
    throw new Error("useSkinCapture must be used within a SkinCaptureProvider");
  }
  return ctx;
}