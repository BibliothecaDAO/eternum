// @vitest-environment node
import type { ActionPath } from "@bibliothecadao/eternum";
import { ActionType } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";

import { computeEffectiveStaminaCost, getPathStaminaCost } from "./path-cost";

const step = (cost: number, actionType: ActionType = ActionType.Move): ActionPath => ({
  hex: { col: 0, row: 0 },
  actionType,
  staminaCost: cost,
});

describe("getPathStaminaCost", () => {
  it("sums staminaCost across steps", () => {
    expect(getPathStaminaCost([step(1), step(2), step(3)])).toBe(6);
  });

  it("treats missing staminaCost as zero", () => {
    expect(getPathStaminaCost([{ staminaCost: undefined }, { staminaCost: 5 }])).toBe(5);
  });

  it("returns 0 for an empty path", () => {
    expect(getPathStaminaCost([])).toBe(0);
  });
});

describe("computeEffectiveStaminaCost", () => {
  it("uses path cost when positive", () => {
    expect(computeEffectiveStaminaCost([step(2), step(3)], ActionType.Explore, 10)).toBe(5);
  });

  it("falls back to exploreStaminaCost only when path cost is 0 and action is Explore", () => {
    expect(computeEffectiveStaminaCost([], ActionType.Explore, 12)).toBe(12);
    expect(computeEffectiveStaminaCost([step(0)], ActionType.Explore, 9)).toBe(9);
  });

  it("keeps zero cost for non-Explore actions", () => {
    expect(computeEffectiveStaminaCost([], ActionType.Move, 12)).toBe(0);
  });
});
