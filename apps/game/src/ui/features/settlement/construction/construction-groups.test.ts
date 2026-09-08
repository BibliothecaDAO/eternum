// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { getConstructionBuildingGroups } from "./construction-groups";
import type { GameModeConfig } from "@/config/game-modes";

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
  it("keeps food first, military tier order and the game mode's exclusions", () => {
    const groups = getConstructionBuildingGroups(mode, []);
    expect(groups.map((group) => group.label)).toEqual(["Economic", "Stable", "Barracks", "Archery"]);
    expect(groups[0].buildings.slice(0, 2)).toEqual([BuildingType.ResourceWheat, BuildingType.ResourceFish]);
    expect(groups[2].buildings).toEqual([BuildingType.ResourceKnightT1, BuildingType.ResourceKnightT2]);
  });
});
