import { NO_END } from "@/ui/design-system/kit/words";
import { ResourcesIds, formatDuration } from "@bibliothecadao/types";

// ==================== CONSTANTS ====================

export const TIER_DISPLAY_NAMES: Record<string, string> = {
  lords: "Lords & Fragments",
  relics: "Relics",
  essence: "Essence",
  research: "Research",
  labor: "Labor",
  military: "Military",
  transport: "Transport",
  food: "Food",
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  unique: "Unique",
  mythic: "Mythic",
  materials: "Materials",
};

export const ALWAYS_SHOW_RESOURCES = [
  ResourcesIds.Lords,
  ResourcesIds.Research,
  ResourcesIds.Labor,
  ResourcesIds.Essence,
  ResourcesIds.Donkey,
  ResourcesIds.Fish,
  ResourcesIds.Wheat,
];

// Resources that don't show time remaining (because they can be produced indefinitely)
export const HIDE_TIME_REMAINING_FOR = [ResourcesIds.Labor];

/** How long a production runs on: a duration, or its own state when it never runs out. */
export const productionTimeLeft = (seconds: number): string =>
  seconds === Number.POSITIVE_INFINITY ? NO_END : formatDuration(seconds);
