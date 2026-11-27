import { BuildingType } from "@bibliothecadao/types";
import { modelPath } from "../utils/model-url";
import { tieredBuildingFamily } from "./frontier-painted-buildings";
import { realmBuildingKitPath } from "./realm-building-kit";

/**
 * The realm-board model of a building upgraded past tier I (models/frontier/buildings/SOURCE.md); none for tier I, which
 * is the original model, or for a building without tiers. Every mode renders by its data: a tier I building looks as it
 * always has.
 */
export const buildingTierModelPath = (category: BuildingType, tier: number | undefined): string | undefined => {
  if (tier === undefined || tier <= 1) return undefined;
  const family = tieredBuildingFamily(category);
  if (family) return realmBuildingKitPath(family, tier);
  return category === BuildingType.Storehouse ? modelPath(`frontier/buildings/storehouse-${tier}.glb`) : undefined;
};
