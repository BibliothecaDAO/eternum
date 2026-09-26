import { describe, expect, it } from "vitest";
import { BuildingType } from "@bibliothecadao/types";
import { buildingTierModelPath } from "./building-tiers";

describe("a building's tier model", () => {
  it("draws the tier's model past tier I, and the original at tier I or for a building without tiers", () => {
    expect(buildingTierModelPath(BuildingType.ResourceWheat, 2)).toBe("/models/frontier/buildings/farm-2.glb");
    expect(buildingTierModelPath(BuildingType.WorkersHut, 3)).toBe("/models/frontier/buildings/workers-hut-3.glb");
    expect(buildingTierModelPath(BuildingType.ResourceWheat, 1)).toBeUndefined();
    expect(buildingTierModelPath(BuildingType.ResourceWheat, undefined)).toBeUndefined();
    expect(buildingTierModelPath(BuildingType.ResourceLabor, 2)).toBeUndefined();
  });
});
