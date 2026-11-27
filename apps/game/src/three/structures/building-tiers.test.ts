import { describe, expect, it } from "vitest";
import { BuildingType } from "@bibliothecadao/types";
import { buildingTierModelPath } from "./building-tiers";
import { realmBuildingKitPath } from "./realm-building-kit";
import { REALM_SUPPORT_PATHS } from "./realm-support-kit";

describe("a building's tier model", () => {
  it("draws the tier's model past tier I, and the original at tier I or for a building without tiers", () => {
    expect(buildingTierModelPath(BuildingType.ResourceWheat, 2)).toBe(realmBuildingKitPath("farm", 2));
    expect(buildingTierModelPath(BuildingType.ResourceLabor, 2)).toBe(realmBuildingKitPath("workshop", 2));
    expect(buildingTierModelPath(BuildingType.ResourceKnightT1, 3)).toBe(realmBuildingKitPath("barracks", 3));
    expect(buildingTierModelPath(BuildingType.Storehouse, 2)).toBe(REALM_SUPPORT_PATHS["storehouse-2"]);
    expect(buildingTierModelPath(BuildingType.Storehouse, 3)).toBe(REALM_SUPPORT_PATHS["storehouse-3"]);
    expect(buildingTierModelPath(BuildingType.Storehouse, 4)).toBe(REALM_SUPPORT_PATHS["storehouse-3"]);
    expect(buildingTierModelPath(BuildingType.Storehouse, 1)).toBeUndefined();
    expect(buildingTierModelPath(BuildingType.ResourceWheat, 1)).toBeUndefined();
    expect(buildingTierModelPath(BuildingType.ResourceWheat, undefined)).toBeUndefined();
    expect(buildingTierModelPath(BuildingType.WorkersHut, 2)).toBeUndefined();
  });
});
