import { divideByPrecision, ResourceManager } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
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

// Resources that cannot be managed in Blitz mode
export const BLITZ_UNMANAGEABLE_RESOURCES = [ResourcesIds.Labor, ResourcesIds.Wheat];

// ==================== CALCULATION HELPERS ====================

export interface ProductionData {
  productionPerSecond: number;
  isProducing: boolean;
  outputRemaining: number;
  timeRemainingSeconds: number;
}

/**
 * Calculate production data for a resource, accounting for elapsed time since last update
 */
export const calculateResourceProductionData = (
  resourceId: ResourcesIds,
  productionInfo: ReturnType<typeof ResourceManager.balanceAndProduction>,
  currentTick: number,
): ProductionData => {
  const productionPerSecond = divideByPrecision(Number(productionInfo.production.production_rate || 0), false);

  // Calculate remaining output after accounting for elapsed time
  const ticksSinceLastUpdate = currentTick - productionInfo.production.last_updated_at;
  const totalAmountProduced = BigInt(ticksSinceLastUpdate) * productionInfo.production.production_rate;
  const isFoodResource = FOOD_RESOURCES.includes(resourceId);
  const remainingOutput = isFoodResource
    ? productionInfo.production.output_amount_left
    : productionInfo.production.output_amount_left - totalAmountProduced;

  const isProducing =
    productionInfo.production.building_count > 0 &&
    productionInfo.production.production_rate !== 0n &&
    remainingOutput > 0n;

  const outputRemainingNumber = Number(remainingOutput) / RESOURCE_PRECISION;
  const timeRemainingSeconds = productionPerSecond > 0 ? outputRemainingNumber / productionPerSecond : 0;

  return {
    productionPerSecond,
    isProducing,
    outputRemaining: outputRemainingNumber,
    timeRemainingSeconds,
  };
};

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
