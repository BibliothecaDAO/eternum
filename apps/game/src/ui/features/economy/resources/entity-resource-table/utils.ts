import { ResourcesIds } from "@bibliothecadao/types";
import { currencyFormat, currencyIntlFormat } from "@/ui/utils/utils";

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

// ==================== FORMATTERS ====================

export const formatProductionPerHour = (perSecond: number): string =>
  perSecond <= 0 ? "-" : `+${currencyIntlFormat(perSecond * 3600, 2)}/h`;

export const formatResourceAmount = (amount: number): string => currencyFormat(amount, 2);

export const formatTimeRemaining = (seconds: number): string => {
  if (seconds <= 0) return "0s";

  // Single largest unit — past a minute the finer precision is just noise.
  if (seconds >= 86_400) return `${Math.floor(seconds / 86_400)}d`;
  if (seconds >= 3_600) return `${Math.floor(seconds / 3_600)}h`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds)}s`;
};
