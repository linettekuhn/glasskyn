import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CircleAnnotation } from "@/types";

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

export interface SkinReviewState {
  moisture: number | null;
  texture: number | null;
  tone: number | null;
  notes: string;
}

const DEFAULT_REVIEW: SkinReviewState = {
  moisture: null,
  texture: null,
  tone: null,
  notes: "",
};

interface SkinCaptureContextType {
  draft: SkinCaptureDraft | null;
  setDraft: (draft: SkinCaptureDraft | null) => void;
  circles: CircleAnnotation[] | null;
  setCircles: (circles: CircleAnnotation[] | null) => void;
  review: SkinReviewState;
  setReview: (next: SkinReviewState | ((prev: SkinReviewState) => SkinReviewState)) => void;
  clearEntry: () => void;
}

const SkinCaptureContext = createContext<SkinCaptureContextType | null>(null);

export function SkinCaptureProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<SkinCaptureDraft | null>(null);
  const [circles, setCirclesState] = useState<CircleAnnotation[] | null>(null);
  const [review, setReviewState] = useState<SkinReviewState>(DEFAULT_REVIEW);

  const setDraft = useCallback((next: SkinCaptureDraft | null) => {
    setDraftState(next);
  }, []);

  const setCircles = useCallback((next: CircleAnnotation[] | null) => {
    setCirclesState(next);
  }, []);

  const setReview = useCallback(
    (next: SkinReviewState | ((prev: SkinReviewState) => SkinReviewState)) => {
      setReviewState((prev) =>
        typeof next === "function" ? next(prev) : next,
      );
    },
    [],
  );

  const clearEntry = useCallback(() => {
    setDraftState(null);
    setCirclesState(null);
    setReviewState(DEFAULT_REVIEW);
  }, []);

  const value = useMemo(
    () => ({ draft, setDraft, circles, setCircles, review, setReview, clearEntry }),
    [draft, setDraft, circles, setCircles, review, setReview, clearEntry],
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
