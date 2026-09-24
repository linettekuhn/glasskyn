import type { SkinLandmarkRefs } from "@/contexts/SkinCaptureContext";
import type { SkinConcernOut } from "@/types";
import { classifyRegion, type SkinRegion } from "./landmark-zones";

export interface LandmarkAnchorRef {
  key: string;
  ox: number;
  oy: number;
  dist: number;
}

export interface ConcernAnchor {
  point: { x: number; y: number };
  region: SkinRegion;
  refs: LandmarkAnchorRef[];
}

const MAX_REF_DIST = 0.4;
const MAX_REFS = 3;
const EPS = 0.001;

function clamp(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function finiteLandmarks(
  landmarks: SkinLandmarkRefs | null | undefined,
): Array<{ key: string; x: number; y: number }> {
  const out: Array<{ key: string; x: number; y: number }> = [];
  for (const [key, p] of Object.entries(landmarks ?? {})) {
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      out.push({ key, x: p.x, y: p.y });
    }
  }
  return out;
}

/**
 * Build a landmark-relative anchor for a concern point.
 * Mirrors backend app/services/skin_anchor.py::compute_anchor.
 */
export function computeAnchor(
  point: { x: number; y: number },
  landmarks: SkinLandmarkRefs | null | undefined,
): ConcernAnchor {
  const lm = finiteLandmarks(landmarks);
  const ordered = lm
    .map((l) => ({
      ...l,
      dist: Math.hypot(point.x - l.x, point.y - l.y),
    }))
    .sort((a, b) => a.dist - b.dist);

  const refs: LandmarkAnchorRef[] = [];
  for (const l of ordered.slice(0, MAX_REFS)) {
    if (l.dist > MAX_REF_DIST) break;
    refs.push({
      key: l.key,
      ox: point.x - l.x,
      oy: point.y - l.y,
      dist: l.dist,
    });
  }

  return {
    point: { x: point.x, y: point.y },
    region: classifyRegion(point, landmarks),
    refs,
  };
}

/**
 * Re-project a stored concern onto a new capture's landmarks via the
 * anchor's nearest-landmark offsets (weighted 1/dist^2). Falls back to the
 * provided coordinates when no ref landmark is available in the new frame.
 */
export function projectConcern(
  anchor: ConcernAnchor | null | undefined,
  newLandmarks: SkinLandmarkRefs | null | undefined,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  const lm = new Map(
    finiteLandmarks(newLandmarks).map((l) => [l.key, l]),
  );
  let weightSum = 0;
  let x = 0;
  let y = 0;
  for (const ref of anchor?.refs ?? []) {
    const target = lm.get(ref.key);
    if (!target) continue;
    const w = 1 / (ref.dist + EPS);
    x += (target.x + ref.ox) * w;
    y += (target.y + ref.oy) * w;
    weightSum += w;
  }
  if (weightSum <= 0) {
    return { x: clamp(fallback.x), y: clamp(fallback.y) };
  }
  return { x: clamp(x / weightSum), y: clamp(y / weightSum) };
}

/**
 * Most recent stored position for a concern (from its history), used as the
 * projection source when carrying it into the next session.
 */
export function lastSeenCoords(
  concern: SkinConcernOut,
): { x: number; y: number } | null {
  const history = concern.history ?? [];
  for (let i = history.length - 1; i >= 0; i--) {
    const coords = history[i]?.coords;
    if (coords && Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
      return { x: coords.x, y: coords.y };
    }
  }
  const anchor = concern.anchor as ConcernAnchor | null | undefined;
  if (anchor?.point) return anchor.point;
  return null;
}