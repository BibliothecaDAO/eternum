import { describe, expect, it } from "vitest";

import { resolveArmyStaminaTickRefresh } from "./army-stamina-tick-policy";

describe("resolveArmyStaminaTickRefresh", () => {
  it("recomputes when the armies tick advances", () => {
    expect(
      resolveArmyStaminaTickRefresh({
        currentTick: 11,
        previousTick: 10,
      }),
    ).toEqual({
      shouldRecompute: true,
      nextTrackedTick: 11,
    });
  });

  it("skips recompute when the armies tick is unchanged", () => {
    expect(
      resolveArmyStaminaTickRefresh({
        currentTick: 11,
        previousTick: 11,
      }),
    ).toEqual({
      shouldRecompute: false,
      nextTrackedTick: 11,
    });
  });

  it("recomputes when the tracked tick must correct backward to chain time", () => {
    expect(
      resolveArmyStaminaTickRefresh({
        currentTick: 11,
        previousTick: 15,
      }),
    ).toEqual({
      shouldRecompute: true,
      nextTrackedTick: 11,
    });
  });
});
