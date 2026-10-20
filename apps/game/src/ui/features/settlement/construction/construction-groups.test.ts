// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuildingType, getResourceTiers, ResourcesIds } from "@bibliothecadao/types";
import { getConstructionBuildingGroups, resolveBuildingRequirements } from "./construction-groups";
import type { GameModeConfig } from "@/config/game-modes";

import { configManager } from "@bibliothecadao/eternum";

afterEach(() => vi.restoreAllMocks());

const mode = {
  rules: { isBuildingTypeAllowed: (name: string) => name !== "ResourceKnightT3" },
  resources: { getTiers: () => getResourceTiers(false) },
} as GameModeConfig;
const blitz = { ...mode, resources: { getTiers: () => getResourceTiers(true) } } as GameModeConfig;
describe("construction groups", () => {
  it("deduplicates realm resources and omits resources unavailable on this realm", () => {
    const groups = getConstructionBuildingGroups(mode, [ResourcesIds.Wood, ResourcesIds.Wood, ResourcesIds.Stone]);
    expect(groups[0]).toEqual({
      label: "Resources",
      buildings: [BuildingType.ResourceWood, BuildingType.ResourceStone],
      // A mode whose resources run in no lines keeps the realm's own order, never re-sorted.
      grid: undefined,
    });
    expect(groups.flatMap((group) => group.buildings)).not.toContain(BuildingType.ResourceGold);
  });
  it("lays Blitz's resources in their lines, a tier a row, leaving a resource the realm lacks an empty cell", () => {
    const groups = getConstructionBuildingGroups(blitz, [
      ResourcesIds.Dragonhide,
      ResourcesIds.Wood,
      ResourcesIds.Gold,
      ResourcesIds.Copper,
      ResourcesIds.Ironwood,
    ]);
    expect(groups[0].grid).toEqual({
      rows: [
        [BuildingType.ResourceWood, null, BuildingType.ResourceCopper],
        [BuildingType.ResourceIronwood, null, BuildingType.ResourceGold],
        [null, null, BuildingType.ResourceDragonhide],
      ],
    });
  });

  it("lays the army in a grid, a troop type a column (Paladin, Knight, Crossbowman) and a tier a row", () => {
    const military = getConstructionBuildingGroups(mode, []).find((group) => group.label === "Military")!;
    expect(military.grid).toEqual({
      heads: ["Stable", "Barracks", "Archery"],
      rows: [
        [BuildingType.ResourcePaladinT1, BuildingType.ResourceKnightT1, BuildingType.ResourceCrossbowmanT1],
        [BuildingType.ResourcePaladinT2, BuildingType.ResourceKnightT2, BuildingType.ResourceCrossbowmanT2],
        // The mode excludes the Knight T3: its cell stays empty, nothing moves into it.
        [BuildingType.ResourcePaladinT3, null, BuildingType.ResourceCrossbowmanT3],
      ],
    });
  });

  it("keeps food first, one army ordered by troop then tier, and the game mode's exclusions", () => {
    const groups = getConstructionBuildingGroups(mode, []);
    expect(groups.map((group) => group.label)).toEqual(["Economic", "Military"]);
    expect(groups[0].buildings.slice(0, 2)).toEqual([BuildingType.ResourceWheat, BuildingType.ResourceFish]);
    expect(groups[1].buildings).toEqual([
      BuildingType.ResourcePaladinT1,
      BuildingType.ResourcePaladinT2,
      BuildingType.ResourcePaladinT3,
      BuildingType.ResourceKnightT1,
      BuildingType.ResourceKnightT2,
      BuildingType.ResourceCrossbowmanT1,
      BuildingType.ResourceCrossbowmanT2,
      BuildingType.ResourceCrossbowmanT3,
    ]);
  });
});

it("requires a known base construction price but no realm research", () => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(7);
  const prices = vi
    .spyOn(configManager, "getBuildingCosts")
    .mockReturnValue([{ resource: ResourcesIds.Labor, amount: 100 }]);
  vi.spyOn(configManager, "getBuildingBaseCostPercentIncrease").mockReturnValue(0);
  const store = { get: (model: string) => (model === "BoardRules" || model === "Structure" ? {} : undefined) } as never;
  expect(resolveBuildingRequirements(9, store, BuildingType.ResourceWheat, true, 0)).toEqual([
    { resource: ResourcesIds.Labor, amount: 100, current: undefined },
  ]);
  // A realm this client has not synced has no known count to scale the price by.
  const unsynced = { get: (model: string) => (model === "BoardRules" ? {} : undefined) } as never;
  expect(resolveBuildingRequirements(9, unsynced, BuildingType.ResourceWheat, true, 0)).toBeUndefined();
  prices.mockReturnValueOnce(undefined);
  expect(resolveBuildingRequirements(9, store, BuildingType.ResourceWheat, true, 0)).toBeUndefined();
});
