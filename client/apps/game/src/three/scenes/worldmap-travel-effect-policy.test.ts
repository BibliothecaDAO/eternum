import { describe, expect, it } from "vitest";
import { resolveExploreCompletionPendingClearPlan } from "./worldmap-travel-effect-policy";

describe("resolveExploreCompletionPendingClearPlan", () => {
  it("returns pending compass effect entities for the explored tile", () => {
    const plan = resolveExploreCompletionPendingClearPlan({
      exploredHexKey: "10,20",
      trackedEffectsByEntity: new Map([
        [1, { key: "10,20", effectType: "compass" }],
        [2, { key: "10,20", effectType: "travel" }],
        [3, { key: "11,20", effectType: "compass" }],
      ]),
      pendingArmyMovements: new Set([1, 2, 3]),
    });

    expect(plan).toEqual([1]);
  });

  it("ignores compass effects that are not pending", () => {
    const plan = resolveExploreCompletionPendingClearPlan({
      exploredHexKey: "4,5",
      trackedEffectsByEntity: new Map([
        [7, { key: "4,5", effectType: "compass" }],
        [8, { key: "4,5", effectType: "compass" }],
      ]),
      pendingArmyMovements: new Set([8]),
    });

    expect(plan).toEqual([8]);
  });

  it("returns an empty list when no tracked effect matches", () => {
    const plan = resolveExploreCompletionPendingClearPlan({
      exploredHexKey: "1,1",
      trackedEffectsByEntity: new Map([[5, { key: "2,2", effectType: "compass" }]]),
      pendingArmyMovements: new Set([5]),
    });

    expect(plan).toEqual([]);
  });
});
