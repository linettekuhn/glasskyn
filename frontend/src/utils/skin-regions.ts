import type { SkinConcernOut, SkinSessionOut } from "@/types";
import type { SkinDayEntry } from "./skin-sessions";

/**
 * Optional region filter (12G) for the journal montage.
 *
 * Each concern's stored anchor (`anchor.region`, pinned at creation via
 * `compute_anchor`) maps to one coarse user-facing zone. Filtering is
 * applied *after* `dayEntries()` so per-concern display numbers stay
 * stable (gaps are fine, renumbering is not).
 */

export type SkinZone =
  | "forehead"
  | "cheeks"
  | "nose"
  | "chin"
  | "jawline"
  | "other";

export const FOREHEAD_REGIONS = ["forehead"] as const;
export const CHEEK_REGIONS = [
  "left_cheek",
  "right_cheek",
  "under_eye_left",
  "under_eye_right",
] as const;
export const NOSE_REGIONS = ["nose"] as const;
export const CHIN_REGIONS = ["chin"] as const;
export const JAWLINE_REGIONS = ["jawline_left", "jawline_right"] as const;

/** Fine-grained anchor regions per zone (for reference / tests). */
export const ZONE_REGION_MAP: Record<Exclude<SkinZone, "other">, readonly string[]> = {
  forehead: FOREHEAD_REGIONS,
  cheeks: CHEEK_REGIONS,
  nose: NOSE_REGIONS,
  chin: CHIN_REGIONS,
  jawline: JAWLINE_REGIONS,
};

export const ZONE_ORDER: SkinZone[] = [
  "forehead",
  "cheeks",
  "nose",
  "chin",
  "jawline",
  "other",
];

export const ZONE_LABELS: Record<SkinZone, string> = {
  forehead: "Forehead",
  cheeks: "Cheeks",
  nose: "Nose",
  chin: "Chin",
  jawline: "Jawline",
  other: "Other",
};

/** Natural phrasing per zone for empty-state messages. */
export const ZONE_PHRASES: Record<SkinZone, string> = {
  forehead: "on your forehead",
  cheeks: "on your cheeks",
  nose: "on your nose",
  chin: "on your chin",
  jawline: "on your jawline",
  other: "in other areas",
};

function normalizeRegion(region: unknown): string {
  return typeof region === "string" ? region.trim().toLowerCase() : "";
}

/** Map a stored anchor region to its user-facing zone. Unknown / missing -> "other". */
export function zoneForRegion(region: unknown): SkinZone {
  const r = normalizeRegion(region);
  if ((FOREHEAD_REGIONS as readonly string[]).includes(r)) return "forehead";
  if ((CHEEK_REGIONS as readonly string[]).includes(r)) return "cheeks";
  if ((NOSE_REGIONS as readonly string[]).includes(r)) return "nose";
  if ((CHIN_REGIONS as readonly string[]).includes(r)) return "chin";
  if ((JAWLINE_REGIONS as readonly string[]).includes(r)) return "jawline";
  return "other";
}

/** Zone for a concern, from its stored (pinned) anchor. Never recomputed. */
export function zoneForConcern(concern: SkinConcernOut): SkinZone {
  return zoneForRegion(concern?.anchor?.region);
}

function concernKey(concern: SkinConcernOut): string {
  if (concern.uuid) return `u:${concern.uuid}`;
  return `id:${concern.id}`;
}

export type ZoneCounts = Record<SkinZone, number> & { all: number };

/**
 * Distinct-concern counts per zone across all sessions (by uuid, so a
 * concern tracked over N sessions counts once, active or healed).
 */
export function zoneCounts(concerns: SkinConcernOut[]): ZoneCounts {
  const seen = new Set<string>();
  const counts: ZoneCounts = {
    all: 0,
    forehead: 0,
    cheeks: 0,
    nose: 0,
    chin: 0,
    jawline: 0,
    other: 0,
  };
  for (const concern of concerns ?? []) {
    const key = concernKey(concern);
    if (seen.has(key)) continue;
    seen.add(key);
    counts[zoneForConcern(concern)] += 1;
  }
  counts.all = seen.size;
  return counts;
}

/** Zone per concern id, memoized by callers keyed on sessions. */
export function zoneByConcernId(
  concerns: SkinConcernOut[],
): Map<number, SkinZone> {
  const map = new Map<number, SkinZone>();
  for (const concern of concerns ?? []) {
    map.set(concern.id, zoneForConcern(concern));
  }
  return map;
}

/** Keep only entries whose concern falls in the selected zones. Empty set = All. */
export function filterEntriesByZones(
  entries: SkinDayEntry[],
  selected: ReadonlySet<SkinZone>,
  zones?: ReadonlyMap<number, SkinZone>,
): SkinDayEntry[] {
  if (selected.size === 0) return entries;
  return entries.filter((entry) => {
    const zone =
      zones?.get(entry.concern.id) ?? zoneForConcern(entry.concern);
    return selected.has(zone);
  });
}

/** "No concerns on your forehead" / "...forehead or chin" / "...in other areas". */
export function noConcernsMessage(zones: SkinZone[]): string {
  const ordered = ZONE_ORDER.filter((z) => zones.includes(z));
  if (ordered.length === 0) return "No concerns here";
  const phrases = ordered.map((z) => ZONE_PHRASES[z]);
  if (phrases.length === 1) return `No concerns ${phrases[0]}`;
  // Natural join: "a, b or c" for 3+, "a or b" for 2.
  if (phrases.length === 2) return `No concerns ${phrases[0]} or ${phrases[1]}`;
  const head = phrases.slice(0, -1).join(", ");
  return `No concerns ${head} or ${phrases[phrases.length - 1]}`;
}

/** Sessions whose entries (post-filter) are empty — for dimming thumbs. */
export function sessionHasMatches(
  sessionId: number,
  dayEntriesFor: (sessionId: number) => SkinDayEntry[],
): boolean {
  return dayEntriesFor(sessionId).length > 0;
}

export type { SkinSessionOut };
