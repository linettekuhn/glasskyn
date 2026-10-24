import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getPreferences, savePreferences } from "@/api/preferences";
import { getWaterIntake, setWaterIntake } from "@/api/water";
import type { Units, UserPreference } from "@/types";
import { mlToOz, ozToMl } from "@/lib/water-units";

export interface SaveGoalPayload {
  water_goal_ml: number;
  water_weight_lb: number | null;
  water_activity_level: string | null;
  water_climate: string | null;
}

export interface UseWaterIntakeResult {
  loaded: boolean;
  prefs: UserPreference | null;
  units: Units;
  isMetric: boolean;
  intakeMl: number;
  goalMl: number;
  progress: number;
  percent: number;
  goalMet: boolean;
  isFirstTime: boolean;
  incrementMl: number;
  canUndo: boolean;
  burstActive: boolean;
  loadTick: number;
  add: (ml: number) => Promise<void>;
  undo: () => Promise<void>;
  reset: () => Promise<void>;
  saveGoal: (payload: SaveGoalPayload) => Promise<boolean>;
  saveIncrement: (ml: number) => Promise<void>;
  displayMl: (ml: number) => string;
}

const UNDO_CAP = 20;

export function useWaterIntake(): UseWaterIntakeResult {
  const [prefs, setPrefs] = useState<UserPreference | null>(null);
  const [intakeMl, setIntakeMl] = useState(0);
  const [undoStack, setUndoStack] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [burstActive, setBurstActive] = useState(false);
  const [loadTick, setLoadTick] = useState(0);

  const undoStackRef = useRef<number[]>([]);
  const intakeRef = useRef(0);
  const celebratedRef = useRef(false);
  const requestIdRef = useRef(0);

  const units: Units = prefs?.units ?? "imperial";
  const isMetric = units === "metric";

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getPreferences(), getWaterIntake()])
        .then(([pref, intake]) => {
          if (!active) return;
          setPrefs(pref);
          intakeRef.current = intake.ml;
          setIntakeMl(intake.ml);
          undoStackRef.current = [];
          setUndoStack([]);
          celebratedRef.current = false;
        })
        .catch(() => {})
        .finally(() => {
          if (active) {
            setLoaded(true);
            setLoadTick((t) => t + 1);
          }
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const goalMl = prefs?.water_goal_ml ?? 0;
  const isFirstTime = prefs != null && goalMl <= 0;
  const goalMet = goalMl > 0 && intakeMl >= goalMl;
  const progress = goalMl > 0 ? Math.min(1, intakeMl / goalMl) : 0;
  const percent = Math.round(progress * 100);
  const incrementMl =
    prefs?.water_increment_ml ?? (isMetric ? 250 : ozToMl(8));

  const displayMl = useCallback(
    (ml: number) =>
      isMetric ? `${ml}ml` : `${Math.round(mlToOz(ml))}oz`,
    [isMetric],
  );

  useEffect(() => {
    if (!loaded) return;
    if (!goalMet) {
      celebratedRef.current = false;
      setBurstActive(false);
      return;
    }
    if (celebratedRef.current) return;
    celebratedRef.current = true;
    setBurstActive(true);
    const timer = setTimeout(() => setBurstActive(false), 1600);
    return () => clearTimeout(timer);
  }, [goalMet, loadTick, loaded]);

  const pushUndo = useCallback((value: number) => {
    undoStackRef.current = [...undoStackRef.current.slice(-(UNDO_CAP - 1)), value];
    setUndoStack(undoStackRef.current);
  }, []);

  const reconcile = useCallback(
    async (id: number, fallback: () => Promise<{ ml: number }>) => {
      try {
        const result = await fallback();
        if (requestIdRef.current === id) {
          intakeRef.current = result.ml;
          setIntakeMl(result.ml);
        }
      } catch {
        try {
          const result = await getWaterIntake();
          if (requestIdRef.current === id) {
            intakeRef.current = result.ml;
            setIntakeMl(result.ml);
          }
        } catch {}
      }
    },
    [],
  );

  const add = useCallback(
    async (amountMl: number) => {
      const id = ++requestIdRef.current;
      const next = Math.max(0, intakeRef.current + amountMl);
      pushUndo(intakeRef.current);
      intakeRef.current = next;
      setIntakeMl(next);
      await reconcile(id, () => setWaterIntake(next));
    },
    [pushUndo, reconcile],
  );

  const undo = useCallback(async () => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const id = ++requestIdRef.current;
    const previous = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    setUndoStack(undoStackRef.current);
    intakeRef.current = previous;
    setIntakeMl(previous);
    await reconcile(id, () => setWaterIntake(previous));
  }, [reconcile]);

  const reset = useCallback(async () => {
    const id = ++requestIdRef.current;
    pushUndo(intakeRef.current);
    intakeRef.current = 0;
    setIntakeMl(0);
    await reconcile(id, () => setWaterIntake(0));
  }, [pushUndo, reconcile]);

  const saveGoal = useCallback(
    async (payload: SaveGoalPayload): Promise<boolean> => {
      try {
        const updated = await savePreferences(payload);
        setPrefs(updated);
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const saveIncrement = useCallback(async (ml: number): Promise<void> => {
    let previous: number | null = null;
    let hadPrefs = false;
    setPrefs((prev) => {
      if (!prev) return prev;
      hadPrefs = true;
      previous = prev.water_increment_ml;
      return { ...prev, water_increment_ml: ml };
    });
    if (!hadPrefs) return;
    try {
      const updated = await savePreferences({ water_increment_ml: ml });
      setPrefs(updated);
    } catch {
      const rollback = previous;
      setPrefs((prev) =>
        prev ? { ...prev, water_increment_ml: rollback } : prev,
      );
    }
  }, []);

  return {
    loaded,
    prefs,
    units,
    isMetric,
    intakeMl,
    goalMl,
    progress,
    percent,
    goalMet,
    isFirstTime,
    incrementMl,
    canUndo: undoStack.length > 0,
    burstActive,
    loadTick,
    add,
    undo,
    reset,
    saveGoal,
    saveIncrement,
    displayMl,
  };
}

export default useWaterIntake;
