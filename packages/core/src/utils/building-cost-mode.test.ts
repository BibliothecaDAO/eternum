import { describe, expect, it } from "vitest";

import blitz from "../../../../config/generated/blitz.madara.json";
import eternum from "../../../../config/generated/eternum.madara.json";
import frontier from "../../../../config/generated/frontier.madara.json";
import { buildingCostModeOf, resolveUseSimpleCost } from "./building-cost-mode";

/** A game's building rules as its generated preset writes them: one row per category, with both cost tables. */
const rulesOf = (preset: { configuration: { buildings: Record<string, Record<string, unknown[]>> } }) => {
  const { simpleBuildingCost, complexBuildingCosts } = preset.configuration.buildings;
  return Object.keys(complexBuildingCosts).map((category) => ({
    simple_cost: simpleBuildingCost[category] ?? [],
    complex_cost: complexBuildingCosts[category],
  }));
};

describe("building cost mode", () => {
  it("reads the mode from each preset's own cost tables", () => {
    expect(buildingCostModeOf(rulesOf(frontier as never))).toBe("simple");
    expect(buildingCostModeOf(rulesOf(eternum as never))).toBe("choice");
    expect(buildingCostModeOf(rulesOf(blitz as never))).toBe("choice");
  });

  it("uses the labor cost where it is the only one, and the player's choice only where both exist", () => {
    expect(resolveUseSimpleCost("simple", false)).toBe(true);
    expect(resolveUseSimpleCost("resource", true)).toBe(false);
    expect(resolveUseSimpleCost("choice", true)).toBe(true);
    expect(resolveUseSimpleCost("choice", false)).toBe(false);
  });
});
