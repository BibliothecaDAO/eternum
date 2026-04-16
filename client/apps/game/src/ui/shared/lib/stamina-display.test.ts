import { describe, expect, it } from "vitest";

import { resolveStaminaDisplay } from "./stamina-display";

describe("resolveStaminaDisplay", () => {
  it("uses committed stamina for the displayed value and bar percentage", () => {
    expect(resolveStaminaDisplay({ current: 90, max: 120, displayRatio: 110 / 120 })).toEqual({
      committedPercentage: 75,
      displayPercentage: 75,
      displayedCurrent: 90,
    });
  });

  it("ignores projected current for the displayed computed value", () => {
    expect(resolveStaminaDisplay({ current: 88, max: 120, projectedCurrent: 90 })).toEqual({
      committedPercentage: 73.33333333333333,
      displayPercentage: 73.33333333333333,
      displayedCurrent: 88,
    });
  });

  it("falls back to committed current when projection is unavailable", () => {
    expect(resolveStaminaDisplay({ current: 88, max: 120 })).toEqual({
      committedPercentage: 73.33333333333333,
      displayPercentage: 73.33333333333333,
      displayedCurrent: 88,
    });
  });
});
