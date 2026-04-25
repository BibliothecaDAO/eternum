// @vitest-environment node

import { describe, expect, it } from "vitest";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";

describe("buildRealmBuildingSummary", () => {
  it("keeps construction-menu order and hides zero-count buildings", async () => {
    const { buildRealmBuildingSummary } = await import("./realm-building-summary");
    const buildingCounts: Partial<Record<BuildingType, number>> = {
      [BuildingType.ResourceWood]: 2,
      [BuildingType.WorkersHut]: 1,
      [BuildingType.ResourceKnightT1]: 3,
    };

    const items = buildRealmBuildingSummary({
      realmResourceIds: [ResourcesIds.Wheat, ResourcesIds.Wood, ResourcesIds.Fish],
      allowedBuildingTypes: [
        BuildingType.WorkersHut,
        BuildingType.ResourceWheat,
        BuildingType.ResourceFish,
        BuildingType.ResourceWood,
        BuildingType.ResourceDonkey,
        BuildingType.ResourceKnightT1,
        BuildingType.ResourceKnightT2,
      ],
      getBuildingCount: (buildingType) => buildingCounts[buildingType] ?? 0,
    });

    expect(items).toEqual([
      { buildingId: BuildingType.ResourceWood, label: "Wood", iconResource: "Wood", count: 2 },
      { buildingId: BuildingType.WorkersHut, label: "Workers Hut", iconResource: "House", count: 1 },
      { buildingId: BuildingType.ResourceKnightT1, label: "Knight T1", iconResource: "Knight", count: 3 },
    ]);
  });

  it("returns an empty list when nothing is built on the selected realm", async () => {
    const { buildRealmBuildingSummary } = await import("./realm-building-summary");

    const items = buildRealmBuildingSummary({
      realmResourceIds: [ResourcesIds.Wheat],
      allowedBuildingTypes: [BuildingType.WorkersHut, BuildingType.ResourceWheat],
      getBuildingCount: () => 0,
    });

    expect(items).toEqual([]);
  });
});
