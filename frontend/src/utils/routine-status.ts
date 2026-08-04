import type { Routine } from "@/types";

export type TimeWindow = "morning" | "midday" | "night";

export type RoutineStatusKey =
  | "amPrompt"
  | "amContinue"
  | "amDone"
  | "missedAmCatchup"
  | "pmPrompt"
  | "pmContinue"
  | "fullDayComplete"
  | "missedBoth"
  | "empty";

export type CtaVariant = "primary" | "outlined" | "link";

export interface RoutineStatus {
  key: RoutineStatusKey;
  message: string;
  ctaLabel: string | null;
  ctaVariant: CtaVariant;
  progress: number;
  done: number;
  total: number;
}

export function getTimeWindow(hour: number): TimeWindow {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 21) return "midday";
  return "night";
}

type SlotStatus = "none" | "not_started" | "partial" | "done";

function slotStatus(count: number, doneCount: number): SlotStatus {
  if (count === 0) return "none";
  if (doneCount === count) return "done";
  if (doneCount === 0) return "not_started";
  return "partial";
}

function fraction(done: number, total: number): number {
  return total === 0 ? 0 : done / total;
}

export function resolveRoutineStatus(
  routine: Routine,
  hour: number,
  streakDays: number | null = null,
): RoutineStatus {
  const amSteps = routine.steps.filter((s) => s.time_of_day === "AM");
  const pmSteps = routine.steps.filter((s) => s.time_of_day === "PM");
  const amTotal = amSteps.length;
  const pmTotal = pmSteps.length;

  if (amTotal + pmTotal === 0) {
    return {
      key: "empty",
      message: "No steps in this routine yet",
      ctaLabel: "View Routine",
      ctaVariant: "link",
      progress: 0,
      done: 0,
      total: 0,
    };
  }

  const amDoneCount = amSteps.filter((s) => s.completed_today).length;
  const pmDoneCount = pmSteps.filter((s) => s.completed_today).length;
  const amStatus = slotStatus(amTotal, amDoneCount);
  const pmStatus = slotStatus(pmTotal, pmDoneCount);

  const amEff = amStatus === "none" ? "done" : amStatus;
  const pmEff = pmStatus === "none" ? "done" : pmStatus;

  if (amEff === "done" && pmEff === "done") {
    const message =
      streakDays != null && streakDays > 0
        ? `Full day, streak's alive 🔥 ${streakDays} day${streakDays === 1 ? "" : "s"}`
        : "Full day, streak's alive 🔥";
    return {
      key: "fullDayComplete",
      message,
      ctaLabel: "View Routine",
      ctaVariant: "link",
      progress: 1,
      done: amTotal + pmTotal,
      total: amTotal + pmTotal,
    };
  }

  const window = getTimeWindow(hour);

  if (window === "morning") {
    if (amStatus === "partial") {
      return {
        key: "amContinue",
        message: `${amDoneCount} of ${amTotal} steps down`,
        ctaLabel: "Keep Going",
        ctaVariant: "primary",
        progress: fraction(amDoneCount, amTotal),
        done: amDoneCount,
        total: amTotal,
      };
    }
    if (amStatus === "done") {
      return {
        key: "amDone",
        message: "AM done. Nice.",
        ctaLabel: "View Routine",
        ctaVariant: "link",
        progress: 1,
        done: amTotal,
        total: amTotal,
      };
    }
    return {
      key: "amPrompt",
      message: "Your AM routine's waiting",
      ctaLabel: "Start Routine",
      ctaVariant: "primary",
      progress: 0,
      done: 0,
      total: amTotal,
    };
  }

  if (amEff === "done") {
    if (pmStatus === "partial") {
      const remaining = pmTotal - pmDoneCount;
      return {
        key: "pmContinue",
        message: `Almost there, ${remaining} step${remaining === 1 ? "" : "s"} left`,
        ctaLabel: "Finish Up",
        ctaVariant: "primary",
        progress: fraction(pmDoneCount, pmTotal),
        done: pmDoneCount,
        total: pmTotal,
      };
    }
    return {
      key: "pmPrompt",
      message: "Time to wind down",
      ctaLabel: "Start PM Routine",
      ctaVariant: "primary",
      progress: 0,
      done: 0,
      total: pmTotal,
    };
  }

  if (pmStatus === "partial") {
    const remaining = pmTotal - pmDoneCount;
    return {
      key: "pmContinue",
      message: `Almost there, ${remaining} step${remaining === 1 ? "" : "s"} left`,
      ctaLabel: "Finish Up",
      ctaVariant: "primary",
      progress: fraction(pmDoneCount, pmTotal),
      done: pmDoneCount,
      total: pmTotal,
    };
  }

  if (pmStatus === "done") {
    return {
      key: "amContinue",
      message: `${amDoneCount} of ${amTotal} steps down`,
      ctaLabel: "Keep Going",
      ctaVariant: "primary",
      progress: fraction(amDoneCount, amTotal),
      done: amDoneCount,
      total: amTotal,
    };
  }

  if (amStatus === "partial") {
    return {
      key: "amContinue",
      message: `${amDoneCount} of ${amTotal} steps down`,
      ctaLabel: "Keep Going",
      ctaVariant: "primary",
      progress: fraction(amDoneCount, amTotal),
      done: amDoneCount,
      total: amTotal,
    };
  }

  if (window === "night") {
    return {
      key: "missedBoth",
      message: "Tomorrow's a fresh one",
      ctaLabel: "Peek at Routine",
      ctaVariant: "outlined",
      progress: 0,
      done: 0,
      total: amTotal + pmTotal,
    };
  }

  return {
    key: "missedAmCatchup",
    message: "Didn't get to AM? No stress, hop in whenever",
    ctaLabel: "Do AM Routine",
    ctaVariant: "primary",
    progress: 0,
    done: 0,
    total: amTotal,
  };
}
