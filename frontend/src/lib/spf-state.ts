export type SpfState =
  | "fresh"
  | "due"
  | "idle"
  | "resting"
  | "indoors"
  | "lapsed";

export const DEFAULT_INTERVAL_MIN = 120;
export const DEFAULT_WINDOW_START = "08:00";
export const DEFAULT_WINDOW_END = "18:00";
export const DEFAULT_WINDOW_START_MIN = 8 * 60;
export const DEFAULT_WINDOW_END_MIN = 18 * 60;
export const LAPSE_AFTER_MS = 2 * 60 * 60 * 1000;

export interface DeriveSpfInput {
  now: Date;
  lastAppliedAt: Date | null;
  intervalMs: number;
  windowStartMin: number;
  windowEndMin: number;
  indoorsDate: string | null;
  today: string;
  lapseAfterMs: number;
}

export function localDateString(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** "08:00" -> minutes from local midnight; falls back on bad input. */
export function parseWindowTime(
  value: string | null | undefined,
  fallback: number,
): number {
  if (!value) return fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallback;
  return h * 60 + m;
}

export function deriveSpfState(input: {
  now: Date;
  lastAppliedAt: Date | null;
  intervalMs: number;
  windowStartMin: number;
  windowEndMin: number;
  indoorsDate: string | null;
  lapseAfterMs: number;
}): { state: SpfState; remainingMs: number | null } {
  const {
    now,
    lastAppliedAt,
    intervalMs,
    windowStartMin,
    windowEndMin,
    indoorsDate,
    lapseAfterMs,
  } = input;

  const today = localDateString(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const inWindow = nowMin >= windowStartMin && nowMin < windowEndMin;
  const appliedToday =
    lastAppliedAt != null && localDateString(lastAppliedAt) === today;

  // Logging an application clears "staying in", so an Indoors flag never
  // survives alongside today's application.
  if (indoorsDate === today && !appliedToday)
    return { state: "indoors", remainingMs: null };
  if (!inWindow) return { state: "resting", remainingMs: null };
  if (!appliedToday) return { state: "idle", remainingMs: null };

  const remaining =
    (lastAppliedAt as Date).getTime() + intervalMs - now.getTime();
  if (remaining > 0) return { state: "fresh", remainingMs: remaining };
  return {
    state: -remaining > lapseAfterMs ? "lapsed" : "due",
    remainingMs: remaining,
  };
}

/** Start of the local day containing `d`, as a Date. */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "1h 20m" / "45m". Caller guarantees ms > 0. */
export function formatRemaining(ms: number): string {
  const totalMin = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "9:40 AM" for the lapsed label. */
export function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
