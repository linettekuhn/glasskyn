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

  type Pt = { x: number; y: number };
  const finite = (p: Pt | undefined): p is Pt =>
    !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const meanY = (pts: Array<Pt | undefined>): number | null => {
    const ys = pts.filter(finite).map((p) => (p as Pt).y);
    return ys.length > 0 ? ys.reduce((a, b) => a + b, 0) / ys.length : null;
  };
  const count = (pts: Array<Pt | undefined>): number =>
    pts.filter(finite).length;

  const leftEye = finite(landmarks.LEFT_EYE) ? landmarks.LEFT_EYE as Pt : undefined;
  const rightEye = finite(landmarks.RIGHT_EYE) ? landmarks.RIGHT_EYE as Pt : undefined;
  const nose = finite(landmarks.NOSE_BASE) ? landmarks.NOSE_BASE as Pt : undefined;
  const mouthL = finite(landmarks.MOUTH_LEFT) ? landmarks.MOUTH_LEFT as Pt : undefined;
  const mouthR = finite(landmarks.MOUTH_RIGHT) ? landmarks.MOUTH_RIGHT as Pt : undefined;
  const mouthB = finite(landmarks.MOUTH_BOTTOM) ? landmarks.MOUTH_BOTTOM as Pt : undefined;
  const cheekL = finite(landmarks.LEFT_CHEEK) ? landmarks.LEFT_CHEEK as Pt : undefined;
  const cheekR = finite(landmarks.RIGHT_CHEEK) ? landmarks.RIGHT_CHEEK as Pt : undefined;
  const earL = finite(landmarks.LEFT_EAR) ? landmarks.LEFT_EAR as Pt : undefined;
  const earR = finite(landmarks.RIGHT_EAR) ? landmarks.RIGHT_EAR as Pt : undefined;

  // Need at least 2 landmarks; mirrors backend skin_anchor.py.
  if (count([leftEye, rightEye, nose, mouthL, mouthR, mouthB, cheekL, cheekR, earL, earR]) < 2) {
    return "unknown";
  }

  // Must stay in sync with backend/app/services/skin_anchor.py.
  const DEFAULT_SPACING = 0.12;
  const CHEEK_TO_EYE_DY = 0.07;
  const NOSE_TO_EYE_DY = 0.06;
  const MOUTH_TO_EYE_DY = 0.12;
  const CHEEK_TO_MOUTH_DY = 0.05;

  let eyeY: number | null = null;
  if (leftEye && rightEye) eyeY = (leftEye.y + rightEye.y) / 2;
  else if (leftEye) eyeY = leftEye.y;
  else if (rightEye) eyeY = rightEye.y;
  else {
    const cheekY = meanY([cheekL, cheekR]);
    const earY = meanY([earL, earR]);
    const mouthY0 = meanY([mouthL, mouthR, mouthB]);
    if (cheekY != null) eyeY = cheekY - CHEEK_TO_EYE_DY;
    else if (earY != null) eyeY = earY;
    else if (nose) eyeY = nose.y - NOSE_TO_EYE_DY;
    else if (mouthY0 != null) eyeY = mouthY0 - MOUTH_TO_EYE_DY;
    else return "unknown";
  }

  let eyeSpacing: number;
  if (leftEye && rightEye) eyeSpacing = Math.abs(rightEye.x - leftEye.x);
  else if (cheekL && cheekR) eyeSpacing = Math.abs(cheekR.x - cheekL.x) * 0.55;
  else if (earL && earR) eyeSpacing = Math.abs(earR.x - earL.x) * 0.4;
  else if (mouthL && mouthR) eyeSpacing = Math.abs(mouthR.x - mouthL.x) * 1.6;
  else eyeSpacing = DEFAULT_SPACING;
  if (!Number.isFinite(eyeSpacing) || eyeSpacing <= 0) eyeSpacing = DEFAULT_SPACING;

  let noseX: number | null = null;
  if (nose) noseX = nose.x;
  else if (mouthL && mouthR) noseX = (mouthL.x + mouthR.x) / 2;
  else if (mouthB) noseX = mouthB.x;
  else if (cheekL && cheekR) noseX = (cheekL.x + cheekR.x) / 2;
  else if (leftEye && rightEye) noseX = (leftEye.x + rightEye.x) / 2;
  else if (earL && earR) noseX = (earL.x + earR.x) / 2;
  else if (leftEye) noseX = leftEye.x + eyeSpacing * 0.5;
  else if (rightEye) noseX = rightEye.x - eyeSpacing * 0.5;
  else if (mouthL) noseX = mouthL.x + eyeSpacing * 0.3;
  else if (mouthR) noseX = mouthR.x - eyeSpacing * 0.3;
  else if (cheekL) noseX = cheekL.x + eyeSpacing * 0.8;
  else if (cheekR) noseX = cheekR.x - eyeSpacing * 0.8;
  else if (earL) noseX = earL.x + eyeSpacing * 1.2;
  else if (earR) noseX = earR.x - eyeSpacing * 1.2;
  if (noseX == null || !Number.isFinite(noseX)) return "unknown";

  const mouthYs = [mouthB, mouthL, mouthR]
    .filter((m): m is Pt => m != null)
    .map((m) => m.y);
  const cheekMeanY = meanY([cheekL, cheekR]);
  const mouthY =
    mouthYs.length > 0
      ? mouthYs.reduce((a, b) => a + b, 0) / mouthYs.length
      : cheekMeanY != null
        ? cheekMeanY + CHEEK_TO_MOUTH_DY
        : (eyeY as number) + Math.max(eyeSpacing, 0.05);
  const mouthX = mouthL && mouthR ? (mouthL.x + mouthR.x) / 2 : noseX;
  const tol = Math.max(eyeSpacing * 0.35, 0.03);
  const eyeYnn: number = eyeY as number;
  if (!Number.isFinite(eyeYnn)) return "unknown";

  if (y < eyeYnn) return "forehead";
  if (y <= mouthY) {
    const band = eyeYnn + (mouthY - eyeYnn) * 0.3;
    if (x < noseX - tol) return y < band ? "under_eye_left" : "left_cheek";
    if (x > noseX + tol) return y < band ? "under_eye_right" : "right_cheek";
    return "nose";
  }
  const halfSpan = Math.max(eyeSpacing * 0.5, 0.06);
  if (x < mouthX - halfSpan) return "jawline_left";
  if (x > mouthX + halfSpan) return "jawline_right";
  return "chin";
}