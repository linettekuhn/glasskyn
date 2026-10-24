import { useMemo } from "react";
import type { SkinConcernOut, SkinSessionOut } from "@/types";
import { allConcerns, concernLabel } from "@/utils/skin-sessions";
import { projectConcern } from "@/utils/anchor";
import { dayNumber, healedInDays } from "@/utils/skin-days";

// Heuristic thresholds for the alignment-confidence fallback. Guesses — tune
// against real sessions (see 12G plan). In particular LOW_CONF_DIVERGENCE
// must survive framing variance: verify with a close-up + far photo pair.
export const LOW_CONF_REF_DIST = 0.09;
export const LOW_CONF_DIVERGENCE = 0.15;

export interface ConcernFrame {
  session: SkinSessionOut;
  /** Stored history coords — the source of truth for display. */
  coords: { x: number; y: number } | null;
  isGap: boolean;
  userCorrected: boolean;
  lowConfidence: boolean;
  dayN: number | null;
  dateIso: string;
}

export interface ConcernTimeline {
  concern: SkinConcernOut;
  label: string;
  statusText: string;
  healed: boolean;
  healedDays: number | null;
  firstIso: string;
  resolvedIso: string | null;
  frames: ConcernFrame[];
}

function sessionById(
  sessions: SkinSessionOut[],
  id: number | null | undefined,
): SkinSessionOut | null {
  if (id == null) return null;
  return sessions.find((s) => s.id === id) ?? null;
}

function nearestRefDist(concern: SkinConcernOut): number | null {
  const refs = (
    concern.anchor as unknown as {
      refs?: Array<{ dist?: number }>;
    } | null
  )?.refs;
  if (!refs || refs.length === 0) return null;
  let min: number | null = null;
  for (const r of refs) {
    if (typeof r?.dist === "number" && Number.isFinite(r.dist)) {
      min = min == null ? r.dist : Math.min(min, r.dist);
    }
  }
  return min;
}

export function buildConcernTimeline(
  sessions: SkinSessionOut[],
  concernUuid: string | null | undefined,
): ConcernTimeline | null {
  if (!concernUuid || sessions.length === 0) return null;
  const concerns = allConcerns(sessions);
  const concern = concerns.find((c) => c.uuid === concernUuid) ?? null;
  if (!concern) return null;

  const ordered = [...sessions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  // First appearance is the creation session by definition. If it was
  // deleted, fall back to the earliest surviving history entry (history is
  // appended chronologically, so the first surviving entry is the earliest).
  const firstSession =
    sessionById(ordered, concern.created_session_id) ??
    (concern.history ?? [])
      .map((h) => sessionById(ordered, h.session_id))
      .find((s): s is SkinSessionOut => s != null) ??
    ordered[0]!;
  const resolvedSession = sessionById(ordered, concern.resolved_session_id);
  const firstIso = firstSession.timestamp;
  const resolvedIso = resolvedSession?.timestamp ?? null;

  const healedDays =
    resolvedIso != null ? healedInDays(firstIso, resolvedIso) : null;
  const healed = resolvedSession != null;
  const statusText = healed
    ? healedDays === 0
      ? "Healed the same day"
      : `Healed in ${healedDays} ${healedDays === 1 ? "day" : "days"}`
    : "Active";

  // Lifespan: first appearance through resolution (or latest session).
  const frames: ConcernFrame[] = [];
  for (const session of ordered) {
    const t = new Date(session.timestamp).getTime();
    if (t < new Date(firstIso).getTime()) continue;
    if (resolvedIso != null && t > new Date(resolvedIso).getTime()) continue;
    const entry = (concern.history ?? []).find(
      (h) => h.session_id === session.id,
    ) as
      | { coords?: { x: number; y: number }; user_corrected?: boolean }
      | undefined;
    // Stored coords are the display position; anchor projection is only the
    // confidence check / fallback, never re-projected over stored values.
    const coords =
      entry?.coords &&
      Number.isFinite(entry.coords.x) &&
      Number.isFinite(entry.coords.y)
        ? { x: entry.coords.x, y: entry.coords.y }
        : null;
    frames.push({
      session,
      coords,
      isGap: coords == null,
      userCorrected: entry?.user_corrected === true,
      lowConfidence: false, // filled by the confidence pass below
      dayN: dayNumber(firstIso, session.timestamp),
      dateIso: session.timestamp,
    });
  }
  // Confidence pass: the original mark is truth. Each frame's stored coords
  // are compared against the pinned anchor projected onto THAT session's
  // landmarks, so slow drift accumulates against one fixed reference instead
  // of chaining frame-to-frame. Raw-coord displacement is deliberately not
  // used: framing (distance/tilt/position) moves correctly placed concerns in
  // raw image coordinates. User-corrected frames bypass (deliberate intent).
  const anchorRefs: Array<{ key: string }> =
    (concern.anchor as unknown as { refs?: Array<{ key: string }> } | null)
      ?.refs ?? [];
  const refDist = nearestRefDist(concern);
  for (const frame of frames) {
    if (frame.isGap || frame.coords == null) {
      continue;
    }
    if (frame.userCorrected) {
      frame.lowConfidence = false;
      continue;
    }
    const landmarks = frame.session.face_landmarks;
    const noLandmarks =
      landmarks == null || Object.keys(landmarks).length === 0;
    const noRefs = refDist == null;
    const farRef = refDist != null && refDist > LOW_CONF_REF_DIST;
    // Skip divergence when projection is impossible: no landmarks (covered
    // by noLandmarks) or no ref-key overlap with this session (projection
    // would fall back and report a meaningless 0). Never pass anchor.point
    // as the fallback — it would mask real divergence.
    let diverged = false;
    if (
      !noLandmarks &&
      !noRefs &&
      anchorRefs.some((r) => landmarks?.[r.key] != null)
    ) {
      const projected = projectConcern(
        concern.anchor as unknown as Parameters<typeof projectConcern>[0],
        landmarks,
        frame.coords,
      );
      diverged =
        Math.hypot(
          frame.coords.x - projected.x,
          frame.coords.y - projected.y,
        ) > LOW_CONF_DIVERGENCE;
    }
    frame.lowConfidence = noLandmarks || noRefs || farRef || diverged;
  }

  return {
    concern,
    label: concernLabel(concern),
    statusText,
    healed,
    healedDays,
    firstIso,
    resolvedIso,
    frames,
  };
}

export function useConcernTimeline(
  sessions: SkinSessionOut[],
  concernUuid: string | null | undefined,
): ConcernTimeline | null {
  return useMemo(
    () => buildConcernTimeline(sessions, concernUuid),
    [sessions, concernUuid],
  );
}
