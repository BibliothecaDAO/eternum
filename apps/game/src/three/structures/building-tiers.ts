import { BuildingType } from "@bibliothecadao/types";
import { tieredBuildingFamily } from "./frontier-painted-buildings";
import { realmBuildingKitPath } from "./realm-building-kit";
import { REALM_SUPPORT_PATHS } from "./realm-support-kit";

export const buildingTierModelPath = (category: BuildingType, tier: number | undefined): string | undefined => {
  if (tier === undefined || tier <= 1) return undefined;
  const family = tieredBuildingFamily(category);
  if (family) return realmBuildingKitPath(family, tier);
  if (category === BuildingType.Storehouse) {
    return tier >= 3 ? REALM_SUPPORT_PATHS["storehouse-3"] : REALM_SUPPORT_PATHS["storehouse-2"];
  }
  return undefined;
};
