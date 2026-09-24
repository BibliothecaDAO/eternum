// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BuildingType } from "@bibliothecadao/types";
import blitz from "../../../../../../../config/generated/blitz.madara.json";
import duel from "../../../../../../../config/generated/duel.madara.json";

type GeneratedPreset = {
  configuration: {
    buildings: Record<"complexBuildingCosts" | "simpleBuildingCost", Record<string, unknown[]>>;
  };
};

const laborBuilding = String(BuildingType.ResourceLabor);

describe("labor production entry points in arena games", () => {
  it.each([
    ["Blitz", blitz],
    ["Duel", duel],
  ])("%s never lists Labor among a realm's productions", (_, preset) => {
    const { buildings } = (preset as GeneratedPreset).configuration;
    // Production lists only the resources of buildings a realm has built, and the Labor building has no cost in either
    // table, which the chain refuses to erect.
    expect(buildings.complexBuildingCosts[laborBuilding] ?? []).toEqual([]);
    expect(buildings.simpleBuildingCost[laborBuilding] ?? []).toEqual([]);
  });
});
