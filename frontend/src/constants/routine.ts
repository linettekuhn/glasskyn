import type { StepType, Frequency } from "@/types";
import type { MaterialCommunityIcons } from "@expo/vector-icons";

export const STEP_LABELS: Record<StepType, string> = {
  cleanse: "Cleanse",
  tone: "Tone",
  treat: "Treat",
  moisturize: "Moisturize",
  spf: "SPF",
  other: "Other",
};

export const STEP_TO_PRODUCT_TYPES: Record<string, string[]> = {
  cleanse: ["cleanser"],
  tone: ["toner"],
  treat: ["serum", "exfoliant", "mask", "spot_treatment"],
  moisturize: ["moisturizer", "oil"],
  spf: ["spf"],
  other: ["other"],
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "daily",
  every_other_day: "every other day",
  weekly: "weekly",
};

type MaterialCommunityIconName = React.ComponentProps<
  typeof MaterialCommunityIcons
>["name"];

export interface CreateRoutineOption {
  icon: MaterialCommunityIconName;
  title: string;
  subtitle: string;
  route?: string;
}

export const CREATE_ROUTINE_OPTIONS: CreateRoutineOption[] = [
  {
    icon: "playlist-plus",
    title: "Create from Scratch",
    subtitle: "Build your own routine",
    route: "/(modals)/routine-manual",
  },
  {
    icon: "clipboard-list-outline",
    title: "Browse Templates",
    subtitle: "Start with a premade routine",
    route: "/(modals)/browse-templates",
  },
  {
    icon: "auto-fix",
    title: "Create with AI",
    subtitle: "Let AI build a routine for you",
    route: "/(main)/chat?generate=1",
  },
];
