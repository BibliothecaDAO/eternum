// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { getConstructionBuildingGroups, resolveBuildingRequirements } from "./construction-groups";
import type { GameModeConfig } from "@/config/game-modes";

import { configManager } from "@bibliothecadao/eternum";

afterEach(() => vi.restoreAllMocks());

const mode = { rules: { isBuildingTypeAllowed: (name: string) => name !== "ResourceKnightT3" } } as GameModeConfig;
describe("construction groups", () => {
  it("deduplicates realm resources and omits resources unavailable on this realm", () => {
    const groups = getConstructionBuildingGroups(mode, [ResourcesIds.Wood, ResourcesIds.Wood, ResourcesIds.Stone]);
    expect(groups[0]).toEqual({
      label: "Resources",
      buildings: [BuildingType.ResourceWood, BuildingType.ResourceStone],
    });
    expect(groups.flatMap((group) => group.buildings)).not.toContain(BuildingType.ResourceGold);
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

it("keeps an unknown researched construction price unknown for the requirement chips", () => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(7);
  vi.spyOn(configManager, "getBuildingCosts").mockReturnValue([{ resource: ResourcesIds.Labor, amount: 100 }]);
  vi.spyOn(configManager, "getBuildingBaseCostPercentIncrease").mockReturnValue(0);
  const store = { get: (model: string) => (model === "BoardRules" ? {} : undefined) } as never;
  expect(resolveBuildingRequirements(9, store, BuildingType.ResourceWheat, true, 0)).toBeUndefined();
});
