// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import blitz from "../../../../../../../config/generated/blitz.madara.json";
import duel from "../../../../../../../config/generated/duel.madara.json";
import { getGameModeConfig } from "@/config/game-modes";

type GeneratedPreset = {
  configuration: {
    resources: Record<"productionByComplexRecipe" | "productionBySimpleRecipe", Record<string, unknown[]>>;
    buildings: Record<"complexBuildingCosts" | "simpleBuildingCost", Record<string, unknown[]>>;
  };
};

const labor = String(ResourcesIds.Labor);
const laborBuilding = String(BuildingType.ResourceLabor);

describe("labor production entry points in arena games", () => {
  it.each([
    ["Blitz", 2, blitz],
    ["Duel", 4, duel],
  ])("%s gives a player no way to produce Labor", (_, presetId, preset) => {
    const { resources, buildings } = (preset as GeneratedPreset).configuration;
    // Production lists only the resources of buildings a realm has built, and the Labor building has no cost in either
    // table, which the chain refuses to erect.
    expect(buildings.complexBuildingCosts[laborBuilding] ?? []).toEqual([]);
    expect(buildings.simpleBuildingCost[laborBuilding] ?? []).toEqual([]);
    expect(resources.productionByComplexRecipe[labor] ?? []).toEqual([]);
    expect(resources.productionBySimpleRecipe[labor] ?? []).toEqual([]);
    expect(getGameModeConfig(presetId).resources.canShowProductionShortcut(ResourcesIds.Labor)).toBe(false);
  });
});
