import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { getPreferences, savePreferences } from "@/api/preferences";
import { applySpf, getSpfStatus, undoSpf } from "@/api/spf";
import type { UserPreference } from "@/types";
import {
  DEFAULT_INTERVAL_MIN,
  DEFAULT_WINDOW_END_MIN,
  DEFAULT_WINDOW_START_MIN,
  LAPSE_AFTER_MS,
  deriveSpfState,
  localDateString,
  parseWindowTime,
  startOfLocalDay,
  type SpfState,
} from "@/lib/spf-state";

interface SpfUndoEntry {
  prev: string | null;
  applied: string | null;
  deletedRows: string[];
  prevIndoors: string | null;
}

export interface UseSpfResult {
  loaded: boolean;
  prefs: UserPreference | null;
  state: SpfState;
  remainingMs: number | null;
  lastAppliedAt: Date | null;
  intervalMin: number;
  todayCount: number;
  indoorsToday: boolean;
  canUndo: boolean;
  apply: () => Promise<void>;
  undo: () => Promise<void>;
  resetToday: () => Promise<void>;
  saveInterval: (min: number) => Promise<void>;
  setIndoors: () => Promise<void>;
  clearIndoors: () => Promise<void>;
}

const UNDO_CAP = 20;
const LABEL_TICK_MS = 45_000;

export function useSpf(): UseSpfResult {
  const [prefs, setPrefs] = useState<UserPreference | null>(null);
  const [lastApplied, setLastApplied] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<SpfUndoEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [, setTick] = useState(0);

  const lastAppliedRef = useRef<string | null>(null);
  const recentRef = useRef<string[]>([]);
  const undoStackRef = useRef<SpfUndoEntry[]>([]);
  const prefsRef = useRef<UserPreference | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getPreferences(), getSpfStatus()])
        .then(([pref, status]) => {
          if (!active) return;
          setPrefs(pref);
          lastAppliedRef.current = status.last_applied_at;
          setLastApplied(status.last_applied_at);
          recentRef.current = status.recent_applied_at;
          setRecent(status.recent_applied_at);
          undoStackRef.current = [];
          setUndoStack([]);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoaded(true);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  // Recompute countdown state when returning to the app (no drift: remaining
  // is always derived from the stored timestamp).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  // Slow ticker for the "1h 20m" label only.
  useEffect(() => {
    if (!loaded) return;
    const timer = setInterval(() => setTick((t) => t + 1), LABEL_TICK_MS);
    return () => clearInterval(timer);
  }, [loaded]);

  const now = new Date();
  const today = localDateString(now);
  const intervalMin = prefs?.spf_interval_min ?? DEFAULT_INTERVAL_MIN;
  const windowStartMin = parseWindowTime(
    prefs?.spf_window_start,
    DEFAULT_WINDOW_START_MIN,
  );
  const windowEndMin = parseWindowTime(
    prefs?.spf_window_end,
    DEFAULT_WINDOW_END_MIN,
  );
  const lastAppliedAt = lastApplied ? new Date(lastApplied) : null;
  const intervalMs = intervalMin * 60 * 1000;
  const indoorsToday = prefs?.spf_indoors_date === today;
  const todayCount = recent.filter(
    (iso) => localDateString(new Date(iso)) === today,
  ).length;

  const dueAt =
    lastAppliedAt != null ? lastAppliedAt.getTime() + intervalMs : null;
  const windowEndToday =
    startOfLocalDay(now).getTime() + windowEndMin * 60 * 1000;
  const lapseAfterMs =
    dueAt != null
      ? Math.max(0, Math.min(LAPSE_AFTER_MS, windowEndToday - dueAt))
      : LAPSE_AFTER_MS;

  const { state, remainingMs } = deriveSpfState({
    now,
    lastAppliedAt,
    intervalMs,
    windowStartMin,
    windowEndMin,
    indoorsDate: prefs?.spf_indoors_date ?? null,
    lapseAfterMs,
  });

  // Single one-shot timer flipping fresh -> due; no per-second ticking.
  useEffect(() => {
    if (!loaded || dueAt == null) return;
    const delay = dueAt - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(() => setTick((t) => t + 1), delay);
    return () => clearTimeout(timer);
  }, [loaded, dueAt]);

  const syncFromStatus = useCallback(
    (status: { last_applied_at: string | null; recent_applied_at: string[] }) => {
      lastAppliedRef.current = status.last_applied_at;
      setLastApplied(status.last_applied_at);
      recentRef.current = status.recent_applied_at;
      setRecent(status.recent_applied_at);
    },
    [],
  );

  const pushUndo = useCallback((entry: SpfUndoEntry) => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-(UNDO_CAP - 1)),
      entry,
    ];
    setUndoStack(undoStackRef.current);
  }, []);

  const apply = useCallback(async () => {
    const id = ++requestIdRef.current;
    const nowIso = new Date().toISOString();
    pushUndo({
      prev: lastAppliedRef.current,
      applied: nowIso,
      deletedRows: [],
      prevIndoors: prefsRef.current?.spf_indoors_date ?? null,
    });
    lastAppliedRef.current = nowIso;
    setLastApplied(nowIso);
    recentRef.current = [nowIso, ...recentRef.current];
    setRecent(recentRef.current);
    // The server clears "staying in" on apply; mirror it optimistically.
    setPrefs((prev) =>
      prev ? { ...prev, spf_indoors_date: null } : prev,
    );
    try {
      const status = await applySpf(nowIso);
      if (requestIdRef.current === id) syncFromStatus(status);
    } catch {
      try {
        const [pref, status] = await Promise.all([
          getPreferences(),
          getSpfStatus(),
        ]);
        if (requestIdRef.current === id) {
          setPrefs(pref);
          syncFromStatus(status);
        }
      } catch {}
    }
  }, [pushUndo, syncFromStatus]);

  const undo = useCallback(async () => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const id = ++requestIdRef.current;
    const entry = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    setUndoStack(undoStackRef.current);
    lastAppliedRef.current = entry.prev;
    setLastApplied(entry.prev);
    const restored = new Set(entry.deletedRows);
    recentRef.current = recentRef.current
      .filter((iso) => iso !== entry.applied && !restored.has(iso))
      .concat(entry.deletedRows)
      .sort()
      .reverse();
    setRecent(recentRef.current);
    if (entry.prevIndoors != null) {
      const indoors = entry.prevIndoors;
      setPrefs((prev) =>
        prev ? { ...prev, spf_indoors_date: indoors } : prev,
      );
    }
    try {
      const status = await undoSpf({
        restore_at: entry.prev,
        remove_log_at: entry.applied,
        restore_rows: entry.deletedRows,
      });
      if (requestIdRef.current === id) syncFromStatus(status);
      if (entry.prevIndoors != null) {
        try {
          const updated = await savePreferences({
            spf_indoors_date: entry.prevIndoors,
          });
          if (requestIdRef.current === id) setPrefs(updated);
        } catch {}
      }
    } catch {
      try {
        const [pref, status] = await Promise.all([
          getPreferences(),
          getSpfStatus(),
        ]);
        if (requestIdRef.current === id) {
          setPrefs(pref);
          syncFromStatus(status);
        }
      } catch {}
    }
  }, [syncFromStatus]);

  const resetToday = useCallback(async () => {
    const id = ++requestIdRef.current;
    const dayStart = startOfLocalDay(new Date());
    const deletedRows = recentRef.current.filter(
      (iso) => new Date(iso) >= dayStart,
    );
    pushUndo({
      prev: lastAppliedRef.current,
      applied: null,
      deletedRows,
      prevIndoors: prefsRef.current?.spf_indoors_date ?? null,
    });
    lastAppliedRef.current = null;
    setLastApplied(null);
    recentRef.current = recentRef.current.filter(
      (iso) => new Date(iso) < dayStart,
    );
    setRecent(recentRef.current);
    try {
      const status = await undoSpf({
        restore_at: null,
        clear_log_after: dayStart.toISOString(),
      });
      if (requestIdRef.current === id) syncFromStatus(status);
    } catch {
      try {
        const [pref, status] = await Promise.all([
          getPreferences(),
          getSpfStatus(),
        ]);
        if (requestIdRef.current === id) {
          setPrefs(pref);
          syncFromStatus(status);
        }
      } catch {}
    }
  }, [pushUndo, syncFromStatus]);

  const saveInterval = useCallback(async (min: number): Promise<void> => {
    let previous: number | null = null;
    let hadPrefs = false;
    setPrefs((prev) => {
      if (!prev) return prev;
      hadPrefs = true;
      previous = prev.spf_interval_min;
      return { ...prev, spf_interval_min: min };
    });
    if (!hadPrefs) return;
    try {
      const updated = await savePreferences({ spf_interval_min: min });
      setPrefs(updated);
    } catch {
      const rollback = previous;
      setPrefs((prev) =>
        prev ? { ...prev, spf_interval_min: rollback } : prev,
      );
    }
  }, []);

  const setIndoors = useCallback(async (): Promise<void> => {
    const todayStr = localDateString(new Date());
    let hadPrefs = false;
    setPrefs((prev) => {
      if (!prev) return prev;
      hadPrefs = true;
      return { ...prev, spf_indoors_date: todayStr };
    });
    if (!hadPrefs) return;
    try {
      const updated = await savePreferences({ spf_indoors_date: todayStr });
      setPrefs(updated);
    } catch {
      setPrefs((prev) =>
        prev && prev.spf_indoors_date === todayStr
          ? { ...prev, spf_indoors_date: null }
          : prev,
      );
    }
  }, []);

  const clearIndoors = useCallback(async (): Promise<void> => {
    let hadPrefs = false;
    setPrefs((prev) => {
      if (!prev) return prev;
      hadPrefs = true;
      return { ...prev, spf_indoors_date: null };
    });
    if (!hadPrefs) return;
    try {
      const updated = await savePreferences({ spf_indoors_date: null });
      setPrefs(updated);
    } catch {
      // Next focus refetch reconciles; keep the optimistic value.
    }
  }, []);

  return {
    loaded,
    prefs,
    state,
    remainingMs,
    lastAppliedAt,
    intervalMin,
    todayCount,
    indoorsToday,
    canUndo: undoStack.length > 0,
    apply,
    undo,
    resetToday,
    saveInterval,
    setIndoors,
    clearIndoors,
  };
}

export default useSpf;
