import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRoutineCalendar } from "@/api/routines";

export interface CalendarMonth {
  year: number;
  /** Zero-based month, matching `Date.getMonth()`. */
  month: number;
}

/**
 * Union of fully completed routine days across routines, as local
 * `YYYY-MM-DD` keys. The calendar reports which months it displays via
 * `ensureMonths`; missing `routine × month` pairs are fetched once and
 * cached until `refreshKey` changes (e.g. a step is toggled).
 */
export function useRoutineCompletionDots(
  routineIds: number[],
  refreshKey = 0,
) {
  const [days, setDays] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);
  const fetched = useRef<Set<string>>(new Set());
  const lastRefreshKey = useRef(refreshKey);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const idsKey = useMemo(() => [...routineIds].sort((a, b) => a - b).join(","), [routineIds]);

  const ensureMonths = useCallback(
    (months: CalendarMonth[]) => {
      if (routineIds.length === 0 || months.length === 0) return;
      if (refreshKey !== lastRefreshKey.current) {
        fetched.current.clear();
        lastRefreshKey.current = refreshKey;
      }
      const missing: { routineId: number; year: number; month: number }[] = [];
      for (const routineId of routineIds) {
        for (const { year, month } of months) {
          const key = `${routineId}:${year}-${month}`;
          if (!fetched.current.has(key)) {
            fetched.current.add(key);
            missing.push({ routineId, year, month });
          }
        }
      }
      if (missing.length === 0) return;
      setLoading(true);
      Promise.all(
        missing.map(({ routineId, year, month }) =>
          getRoutineCalendar(routineId, month + 1, year).catch(() => []),
        ),
      )
        .then((results) => {
          if (!mounted.current) return;
          setDays((prev) => {
            const next = new Map(prev);
            for (const data of results) {
              for (const d of data) {
                // Union: a day counts once any routine was fully done.
                if (d.completed) next.set(d.date, true);
                else if (!next.has(d.date)) next.set(d.date, false);
              }
            }
            return next;
          });
        })
        .finally(() => {
          if (mounted.current) setLoading(false);
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey, refreshKey],
  );

  const completedDays = useMemo(() => {
    const out = new Set<string>();
    for (const [date, completed] of days) {
      if (completed) out.add(date);
    }
    return out;
  }, [days]);

  return { completedDays, loading, ensureMonths };
}
