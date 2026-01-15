import { ResourcesIds } from "@bibliothecadao/types";
import { currencyFormat, currencyIntlFormat } from "@/ui/utils/utils";

// ==================== CONSTANTS ====================

export const TIER_DISPLAY_NAMES: Record<string, string> = {
  lords: "Lords & Fragments",
  relics: "Relics",
  essence: "Essence",
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
  ResourcesIds.Labor,
  ResourcesIds.Essence,
  ResourcesIds.Donkey,
  ResourcesIds.Fish,
  ResourcesIds.Wheat,
];

// Resources that don't show time remaining (because they can be produced indefinitely)
export const HIDE_TIME_REMAINING_FOR = [ResourcesIds.Labor];

// Food resources (unlimited production - no output_amount_left constraint)
export const FOOD_RESOURCES = [ResourcesIds.Wheat, ResourcesIds.Fish];

// ==================== FORMATTERS ====================

export const formatProductionPerHour = (perSecond: number): string =>
  perSecond <= 0 ? "-" : `+${currencyIntlFormat(perSecond * 3600, 2)}/h`;

export const formatResourceAmount = (amount: number): string => currencyFormat(amount, 2);

export const formatTimeRemaining = (seconds: number): string => {
  if (seconds <= 0) return "0s";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};
