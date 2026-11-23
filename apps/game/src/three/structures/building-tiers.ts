import { BuildingType } from "@bibliothecadao/types";
import { modelPath } from "../utils/model-url";

const TIERED_MODELS: Partial<Record<BuildingType, string>> = {
  [BuildingType.ResourceWheat]: "farm",
  [BuildingType.ResourceKnightT1]: "barracks",
  [BuildingType.Storehouse]: "storehouse",
};

/**
 * The realm-board model of a building upgraded past tier I (models/frontier/buildings/SOURCE.md); none for tier I, which
 * is the original model, or for a building without tiers. Every mode renders by its data: a tier I building looks as it
 * always has.
 */
export const buildingTierModelPath = (category: BuildingType, tier: number | undefined): string | undefined => {
  const name = TIERED_MODELS[category];
  return name && tier !== undefined && tier > 1 ? modelPath(`frontier/buildings/${name}-${tier}.glb`) : undefined;
};
