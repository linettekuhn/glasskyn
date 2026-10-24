/**
 * Fixed-geometry crop math for the single-concern progression view (12G).
 *
 * One normalized width (CROP_FRAC of image width) is used for every session
 * so the eye reads change, not jitter. The normalized height derives from
 * the photo aspect (rh = rw * aspect) so the on-screen crop stays square
 * with uniform scale (no distortion). Rects are clamped at image edges
 * rather than shrunk.
 */

/** Fraction of image width shown in every crop. Generous surrounding skin. */
export const CONCERN_CROP_FRAC = 0.38;

export interface NormRect {
  x0: number;
  y0: number;
  rw: number;
  rh: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Square-on-screen crop rect in normalized image space. */
export function getConcernCropRect(
  center: { x: number; y: number },
  aspect: number | null | undefined,
  frac: number = CONCERN_CROP_FRAC,
): NormRect {
  const a =
    aspect != null && Number.isFinite(aspect) && aspect > 0 ? aspect : 0.75;
  const rw = Math.min(1, frac);
  const rh = Math.min(1, rw * a);
  const cx = clamp01(center.x);
  const cy = clamp01(center.y);
  let x0 = cx - rw / 2;
  let y0 = cy - rh / 2;
  x0 = Math.min(Math.max(0, x0), Math.max(0, 1 - rw));
  y0 = Math.min(Math.max(0, y0), Math.max(0, 1 - rh));
  return { x0, y0, rw, rh };
}

/** Absolute layout for the full photo inside an SxS clipped container. */
export function cropImageLayout(
  containerSize: number,
  rect: NormRect,
): { width: number; height: number; left: number; top: number } {
  const width = containerSize / rect.rw;
  const height = containerSize / rect.rh;
  return {
    width,
    height,
    left: -rect.x0 * width,
    top: -rect.y0 * height,
  };
}

/** Dot position (center) inside the SxS crop container. */
export function cropDotPosition(
  containerSize: number,
  rect: NormRect,
  point: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: ((point.x - rect.x0) / rect.rw) * containerSize,
    y: ((point.y - rect.y0) / rect.rh) * containerSize,
  };
}
