import type { Routine } from "@/types";

export type TimeWindow = "morning" | "midday" | "night";

export type RoutineStatusKey =
  | "amPrompt"
  | "amContinue"
  | "amDone"
  | "amCatchupPartial"
  | "nightDoneAmOpen"
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
  caption?: string;
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
      message: "No steps yet",
      caption: "Let's build your routine",
      ctaLabel: "Build Routine",
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
    const caption =
      streakDays != null && streakDays > 0
        ? `${streakDays} day${streakDays === 1 ? "" : "s"} and counting`
        : "First day of many";
    return {
      key: "fullDayComplete",
      message: "Glow secured for today",
      caption,
      ctaLabel: "See Today's Progress",
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
        caption: "Keep the streak going",
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
        message: "Morning routine done!",
        caption: "See you tonight",
        ctaLabel: "View Routine",
        ctaVariant: "link",
        progress: 1,
        done: amTotal,
        total: amTotal,
      };
    }
    return {
      key: "amPrompt",
      message: "Good morning",
      caption: "Your routine's waiting",
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
        message: "Almost there",
        caption: `${remaining} step${remaining === 1 ? "" : "s"} left`,
        ctaLabel: "Finish Up",
        ctaVariant: "primary",
        progress: fraction(pmDoneCount, pmTotal),
        done: pmDoneCount,
        total: pmTotal,
      };
    }
    return {
      key: "pmPrompt",
      message: "Ready to wind down?",
      caption: "Start your night routine",
      ctaLabel: "Start Night Routine",
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
      message: "Almost there",
      caption: `${remaining} step${remaining === 1 ? "" : "s"} left`,
      ctaLabel: "Finish Up",
      ctaVariant: "primary",
      progress: fraction(pmDoneCount, pmTotal),
      done: pmDoneCount,
      total: pmTotal,
    };
  }

  // PM finished but AM was skipped earlier today. Distinct from the
  // "still working through AM" case below, so it gets its own copy.
  if (pmStatus === "done") {
    return {
      key: "nightDoneAmOpen",
      message: "Night done, morning's still open",
      caption: "Catch up before tomorrow",
      ctaLabel: "Catch Up on Morning",
      ctaVariant: "primary",
      progress: fraction(amDoneCount, amTotal),
      done: amDoneCount,
      total: amTotal,
    };
  }

  // Midday/night, AM partially done, PM not started/none.
  if (amStatus === "partial") {
    return {
      key: "amCatchupPartial",
      message: `${amDoneCount} of ${amTotal} morning steps done`,
      caption: "Finish before you forget",
      ctaLabel: "Finish Morning",
      ctaVariant: "primary",
      progress: fraction(amDoneCount, amTotal),
      done: amDoneCount,
      total: amTotal,
    };
  }

  if (window === "night") {
    return {
      key: "missedBoth",
      message: "Fresh start tomorrow",
      caption: "Rest up, see you in the morning",
      ctaLabel: "Peek at Routine",
      ctaVariant: "outlined",
      progress: 0,
      done: 0,
      total: amTotal + pmTotal,
    };
  }

  return {
    key: "missedAmCatchup",
    message: "Skipped your morning?",
    caption: "No stress, jump in anytime",
    ctaLabel: "Do Morning Routine",
    ctaVariant: "primary",
    progress: 0,
    done: 0,
    total: amTotal,
  };
}
