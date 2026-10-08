import { useMemo } from "react";
import type { SkinConcernOut, SkinSessionOut } from "@/types";
import { allConcerns, concernLabel } from "@/utils/skin-sessions";
import { dayNumber, healedInDays } from "@/utils/skin-days";

// Heuristic thresholds for the alignment-confidence fallback. Guesses — tune
// against real sessions (see 12G plan).
export const LOW_CONF_REF_DIST = 0.3;
export const LOW_CONF_DISPLACEMENT = 0.15;

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
  const refs = (concern.anchor as unknown as {
    refs?: Array<{ dist?: number }>;
  } | null)?.refs;
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
  const concern =
    concerns.find((c) => c.uuid === concernUuid) ?? null;
  if (!concern) return null;

  const ordered = [...sessions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const firstSession =
    sessionById(ordered, concern.history?.[0]?.session_id) ??
    sessionById(ordered, concern.created_session_id) ??
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
      lowConfidence: false, // filled below (needs previous-frame context)
      dayN: dayNumber(firstIso, session.timestamp),
      dateIso: session.timestamp,
    });
  }

  // Confidence pass: user-corrected frames are always high confidence.
  let prevCoords: { x: number; y: number } | null = null;
  const refDist = nearestRefDist(concern);
  for (const frame of frames) {
    if (frame.isGap || frame.coords == null) {
      continue;
    }
    if (frame.userCorrected) {
      frame.lowConfidence = false;
      prevCoords = frame.coords;
      continue;
    }
    const noLandmarks =
      frame.session.face_landmarks == null ||
      Object.keys(frame.session.face_landmarks ?? {}).length === 0;
    const noRefs = refDist == null;
    const farRef = refDist != null && refDist > LOW_CONF_REF_DIST;
    const displacement =
      prevCoords != null
        ? Math.hypot(
            frame.coords.x - prevCoords.x,
            frame.coords.y - prevCoords.y,
          )
        : 0;
    const jumped =
      prevCoords != null && displacement > LOW_CONF_DISPLACEMENT;
    // Note: projected-vs-stored divergence is intentionally NOT a signal
    // here — stored coords were already projected at capture time so they
    // mostly match. Landmark / ref-distance / displacement do the real work.
    frame.lowConfidence = noLandmarks || noRefs || farRef || jumped;
    prevCoords = frame.coords;
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
