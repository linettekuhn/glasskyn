import { TAXONOMY } from "@/constants/taxonomy";
import type {
  Concern,
  SkinConcernOut,
  SkinSessionOut,
} from "@/types";

/**
 * `SkinConcern.label` stores the concern id (e.g. "papule"), not a human
 * label — see `POST /skin/check-in`. Resolve display labels through this map.
 */
export const CONCERN_BY_ID: Map<string, Concern> = new Map(
  TAXONOMY.map((concern) => [concern.id, concern]),
);

export interface SkinDayEntry {
  concern: SkinConcernOut;
  /** Normalized coords of this concern on this day's session. */
  coords: { x: number; y: number };
  /** First logged on this day's session. */
  isNew: boolean;
  /** Marked resolved on this day's session. */
  resolvedHere: boolean;
  /** Carried forward from an earlier check-in. */
  carried: boolean;
  /** 1-based marker number, stable across check-ins (ordered by concern id). */
  number: number;
}

/** Local `YYYY-MM-DD` for an ISO timestamp, mirroring `localToday()`. */
export function localDayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Groups sessions by local day, each day's sessions newest first. */
export function groupSessionsByDay(
  sessions: SkinSessionOut[],
): Map<string, SkinSessionOut[]> {
  const map = new Map<string, SkinSessionOut[]>();
  for (const session of sessions) {
    const key = localDayKey(session.timestamp);
    if (!key) continue;
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(session);
    } else {
      map.set(key, [session]);
    }
  }
  for (const bucket of map.values()) {
    bucket.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }
  return map;
}

/**
 * Every concern present on a given session: the ones created there plus any
 * carried forward from an earlier check-in. The backend only returns concerns
 * whose `created_session_id` matches, so carried ones are recovered by
 * scanning each concern's `history[]` for an entry on this session.
 */
export function dayEntries(
  sessionId: number,
  allConcerns: SkinConcernOut[],
): SkinDayEntry[] {
  const entries: SkinDayEntry[] = [];
  for (const concern of allConcerns) {
    const history = concern.history ?? [];
    const isNew = concern.created_session_id === sessionId;
    const hit = history.find((h) => h.session_id === sessionId);
    // Only fall back to the first entry for a concern created on this
    // session; otherwise a concern absent from this day would still match
    // via `history[0]` and show up on every card.
    const coords = hit?.coords ?? (isNew ? history[0]?.coords : undefined);
    if (!coords) continue;
    entries.push({
      concern,
      coords,
      isNew,
      resolvedHere: concern.resolved_session_id === sessionId,
      carried: !isNew,
      number: 0,
    });
  }
  entries.sort((a, b) => a.concern.id - b.concern.id);
  return entries.map((entry, index) => ({ ...entry, number: index + 1 }));
}

/** Flatten every session's concerns, de-duplicated by concern id. */
export function allConcerns(sessions: SkinSessionOut[]): SkinConcernOut[] {
  const byId = new Map<number, SkinConcernOut>();
  for (const session of sessions) {
    for (const concern of session.concerns ?? []) {
      byId.set(concern.id, concern);
    }
  }
  return Array.from(byId.values());
}

/** Display label for a concern; `null`/unknown ids fall back to a status word. */
export function concernLabel(concern: SkinConcernOut): string {
  if (concern.label) {
    return CONCERN_BY_ID.get(concern.label)?.label ?? concern.label;
  }
  return concern.status === "skipped" ? "Skipped" : "Unlabeled";
}
