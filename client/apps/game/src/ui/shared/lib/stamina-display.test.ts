import { describe, expect, it } from "vitest";

import { resolveStaminaDisplay } from "./stamina-display";

describe("resolveStaminaDisplay", () => {
  it("aligns displayed value and projected percentage from display ratio", () => {
    expect(resolveStaminaDisplay({ current: 90, max: 120, displayRatio: 110 / 120 })).toEqual({
      committedPercentage: 75,
      projectedPercentage: 91.66666666666666,
      displayedCurrent: 110,
    });
  });

  it("uses projected current as the display source when available", () => {
    expect(resolveStaminaDisplay({ current: 88, max: 120, projectedCurrent: 90 })).toEqual({
      committedPercentage: 73.33333333333333,
      projectedPercentage: 75,
      displayedCurrent: 90,
    });
  });

  it("falls back to committed current when projection is unavailable", () => {
    expect(resolveStaminaDisplay({ current: 88, max: 120 })).toEqual({
      committedPercentage: 73.33333333333333,
      projectedPercentage: 73.33333333333333,
      displayedCurrent: 88,
    });
  });
});
