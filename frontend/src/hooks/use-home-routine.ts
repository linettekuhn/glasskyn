import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  getRoutineCalendar,
  listRoutines,
  localToday,
} from "@/api/routines";
import type { Routine } from "@/types";
import {
  resolveRoutineStatus,
  type RoutineStatus,
} from "@/utils/routine-status";

function isoKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function useHomeRoutine() {
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<number | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRoutines("skincare", localToday());
      setRoutine(data.find((r) => r.is_active) ?? data[0] ?? null);
    } catch {
      setRoutine(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const preliminary = useMemo(
    () => (routine ? resolveRoutineStatus(routine, new Date().getHours()) : null),
    [routine],
  );

  useEffect(() => {
    if (!routine || preliminary?.key !== "fullDayComplete") {
      setStreak(null);
      return;
    }
    let cancelled = false;
    const today = new Date();
    const curMonth = today.getMonth() + 1;
    const curYear = today.getFullYear();
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonth = prev.getMonth() + 1;
    const prevYear = prev.getFullYear();
    Promise.all([
      getRoutineCalendar(routine.id, curMonth, curYear),
      getRoutineCalendar(routine.id, prevMonth, prevYear),
    ])
      .then(([currentDays, prevDays]) => {
        if (cancelled) return;
        const completed = new Map<string, boolean>();
        for (const d of [...prevDays, ...currentDays]) {
          completed.set(d.date, d.completed);
        }
        let count = 0;
        const cursor = new Date();
        while (completed.get(isoKey(cursor))) {
          count++;
          cursor.setDate(cursor.getDate() - 1);
        }
        setStreak(count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [routine, preliminary?.key]);

  const status = useMemo<RoutineStatus | null>(() => {
    if (!routine) return null;
    return resolveRoutineStatus(routine, new Date().getHours(), streak);
  }, [routine, streak]);

  return { routine, status, loading, refetch };
}
