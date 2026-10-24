import { useCallback, useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import type { TipCategory, TipOutput } from "@/utils/face-gating";

export const TIP_HOLD_MS = 500;
export const TIP_FADE_MS = 120;
export const SUCCESS_MESSAGE = "Hold still";

export type TipKind = TipCategory | "success";

export interface GuideTipState {
  /** Text currently on screen (the single prioritized tip, or "Hold still"). */
  text: string;
  category: TipKind;
  /** Drives the crossfade — bind to an Animated wrapper's `opacity`. */
  opacity: Animated.Value;
}

function toDisplay(tip: TipOutput | null): { kind: TipKind; message: string } {
  return tip
    ? { kind: tip.category, message: tip.message }
    : { kind: "success", message: SUCCESS_MESSAGE };
}

/**
 * Holds a single, prioritized tip on screen with a minimum duration, and
 * crossfades the text when it changes.
 *
 * Commit rules on each new evaluation:
 * - identical (category + message) input is ignored.
 * - commit immediately when nothing has been shown yet, when the minimum
 *   hold has elapsed, or when the gate behind the currently shown tip has
 *   now fully passed (it's no longer failing at all).
 * - otherwise queue the latest evaluation and apply it once the hold is up,
 *   using a single timer so flickering never restarts the countdown.
 */
export function useGuideTip(tip: TipOutput | null): GuideTipState {
  const [text, setText] = useState<string>(() => toDisplay(tip).message);
  const opacity = useRef(new Animated.Value(1)).current;

  const displayedRef = useRef<{ kind: TipKind; message: string } | null>(null);
  const setAtRef = useRef(0);
  const latestRef = useRef(tip);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  latestRef.current = tip;

  const apply = useCallback(
    (next: { kind: TipKind; message: string }) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      displayedRef.current = next;
      setAtRef.current = Date.now();
      setText((prev) => {
        if (prev === next.message) return prev;
        Animated.timing(opacity, {
          toValue: 0,
          duration: TIP_FADE_MS,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) return;
          setText(next.message);
          Animated.timing(opacity, {
            toValue: 1,
            duration: TIP_FADE_MS,
            useNativeDriver: true,
          }).start();
        });
        return prev;
      });
    },
    [opacity],
  );

  useEffect(() => {
    const next = toDisplay(latestRef.current);
    const displayed = displayedRef.current;

    if (
      displayed &&
      displayed.kind === next.kind &&
      displayed.message === next.message
    ) {
      return;
    }

    const now = Date.now();
    const held = !displayed || now - setAtRef.current >= TIP_HOLD_MS;
    const shownPassed =
      displayed != null &&
      displayed.kind !== "success" &&
      !(latestRef.current?.failing ?? []).includes(displayed.kind as TipCategory);

    if (held || shownPassed) {
      apply(next);
      return;
    }

    if (timerRef.current) return;
    const remaining = TIP_HOLD_MS - (now - setAtRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      apply(toDisplay(latestRef.current));
    }, remaining);
  }, [tip, apply]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { text, category: displayedRef.current?.kind ?? "success", opacity };
}