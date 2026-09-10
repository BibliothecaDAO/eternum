import { describe, expect, it } from "vitest";

import { resolveArmyStaminaTickRefresh } from "./army-stamina-tick-policy";

describe("ArmyManager chain-time updates", () => {
  it("recomputes stamina only when the armies tick advances", () => {
    expect(resolveArmyStaminaTickRefresh({ currentTick: 5, previousTick: 5 })).toEqual({
      nextTrackedTick: 5,
      shouldRecompute: false,
    });
    expect(resolveArmyStaminaTickRefresh({ currentTick: 6, previousTick: 5 })).toEqual({
      nextTrackedTick: 6,
      shouldRecompute: true,
    });
  });
});
