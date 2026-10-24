import { localDayKey } from "./skin-sessions";

function parseDayParts(iso: string): {
  year: number;
  month: number;
  day: number;
} | null {
  // localDayKey returns local YYYY-MM-DD; reuse it so DST/timezone match cards.
  const key = localDayKey(iso);
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  return { year: y, month: m, day: d };
}

/**
 * Calendar-day difference in the user's local timezone.
 * 11pm -> 8am next day = 1. Returns null on unparseable input.
 */
export function calendarDayDiff(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): number | null {
  if (!startIso || !endIso) return null;
  const start = parseDayParts(startIso);
  const end = parseDayParts(endIso);
  if (!start || !end) return null;
  const startMs = Date.UTC(start.year, start.month - 1, start.day);
  const endMs = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endMs - startMs) / 86400000);
}

/** 1-indexed day number: first appearance = Day 1. */
export function dayNumber(
  firstIso: string | null | undefined,
  sessionIso: string | null | undefined,
): number | null {
  const diff = calendarDayDiff(firstIso, sessionIso);
  return diff == null ? null : diff + 1;
}

/**
 * Days from first appearance to resolution. Same-day heal = 0; callers
 * render 0 as "Healed the same day". Null when dates are missing.
 */
export function healedInDays(
  firstIso: string | null | undefined,
  resolvedIso: string | null | undefined,
): number | null {
  const diff = calendarDayDiff(firstIso, resolvedIso);
  return diff == null ? null : Math.max(0, diff);
}

/** Legacy 12F helper, now backed by calendar days: max(0, diff). */
export function daysSince(
  fromIso: string | null | undefined,
  nowIso: string = new Date().toISOString(),
): number | null {
  const diff = calendarDayDiff(fromIso, nowIso);
  return diff == null ? null : Math.max(0, diff);
}
