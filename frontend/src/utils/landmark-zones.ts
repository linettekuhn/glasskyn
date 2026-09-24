import type { SkinLandmarkRefs } from "@/contexts/SkinCaptureContext";

export type SkinRegion =
  | "forehead"
  | "under_eye_left"
  | "under_eye_right"
  | "left_cheek"
  | "right_cheek"
  | "nose"
  | "chin"
  | "jawline_left"
  | "jawline_right"
  | "unknown";

export interface RegionPoint {
  x: number;
  y: number;
}

/**
 * Filter chips (12G) group the fine-grained zones into coarse areas.
 * The stored per-concern region stays fine-grained in the anchor.
 */
export const REGION_GROUPS: Record<string, SkinRegion[]> = {
  forehead: ["forehead"],
  cheeks: ["left_cheek", "right_cheek", "under_eye_left", "under_eye_right"],
  chin: ["chin"],
  jawline: ["jawline_left", "jawline_right"],
  nose: ["nose"],
};

export function classifyRegion(
  point: RegionPoint,
  landmarks: SkinLandmarkRefs | null | undefined,
): SkinRegion {
  const { x, y } = point;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "unknown";
  if (!landmarks) return "unknown";

  const leftEye = landmarks.LEFT_EYE;
  const rightEye = landmarks.RIGHT_EYE;
  const nose = landmarks.NOSE_BASE;
  const mouthL = landmarks.MOUTH_LEFT;
  const mouthR = landmarks.MOUTH_RIGHT;
  const mouthB = landmarks.MOUTH_BOTTOM;
  if (!leftEye || !rightEye || !nose) return "unknown";

  const eyeY = (leftEye.y + rightEye.y) / 2;
  const eyeSpacing = Math.abs(rightEye.x - leftEye.x);
  const mouthYs = [mouthB, mouthL, mouthR]
    .filter((m): m is { x: number; y: number } => m != null)
    .map((m) => m.y);
  const mouthY =
    mouthYs.length > 0
      ? mouthYs.reduce((a, b) => a + b, 0) / mouthYs.length
      : eyeY + Math.max(eyeSpacing, 0.05);
  const noseX = nose.x;
  const mouthX = mouthL && mouthR ? (mouthL.x + mouthR.x) / 2 : noseX;
  const tol = Math.max(eyeSpacing * 0.35, 0.03);

  if (y < eyeY) return "forehead";
  if (y <= mouthY) {
    const band = eyeY + (mouthY - eyeY) * 0.3;
    if (x < noseX - tol) return y < band ? "under_eye_left" : "left_cheek";
    if (x > noseX + tol) return y < band ? "under_eye_right" : "right_cheek";
    return "nose";
  }
  const halfSpan = Math.max(eyeSpacing * 0.5, 0.06);
  if (x < mouthX - halfSpan) return "jawline_left";
  if (x > mouthX + halfSpan) return "jawline_right";
  return "chin";
}