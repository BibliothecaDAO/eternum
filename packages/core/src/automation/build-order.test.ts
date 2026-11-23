import { BuildingType, RealmLevels, TroopTier } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { DEFAULT_BUILD_STEPS } from "./build-order";

describe("build order rules", () => {
  it("reads the owner's default: farms first at each rank, wood, coal and copper together, barracks, the first army", () => {
    const city = DEFAULT_BUILD_STEPS.filter((step) => step.rank === RealmLevels.City);
    expect(DEFAULT_BUILD_STEPS[0]).toEqual({
      rank: RealmLevels.Settlement,
      kind: "building",
      building: BuildingType.ResourceWheat,
      count: 2,
    });
    expect(city).toEqual([
      { rank: RealmLevels.City, kind: "building", building: BuildingType.ResourceWheat, count: 4 },
      { rank: RealmLevels.City, kind: "building", building: BuildingType.ResourceWood, count: 1 },
      { rank: RealmLevels.City, kind: "building", building: BuildingType.ResourceCoal, count: 1 },
      { rank: RealmLevels.City, kind: "building", building: BuildingType.ResourceCopper, count: 1 },
      { rank: RealmLevels.City, kind: "building", building: BuildingType.ResourceWood, count: 2 },
      { rank: RealmLevels.City, kind: "building", building: BuildingType.ResourceCoal, count: 2 },
      { rank: RealmLevels.City, kind: "building", building: BuildingType.ResourceCopper, count: 2 },
      { rank: RealmLevels.City, kind: "barracks", tier: TroopTier.T1, count: 1 },
      { rank: RealmLevels.City, kind: "army", tier: TroopTier.T1, count: 1 },
    ]);
    expect(DEFAULT_BUILD_STEPS.at(-1)).toEqual({
      rank: RealmLevels.Empire,
      kind: "barracks",
      tier: TroopTier.T1,
      count: 5,
    });
  });
});
