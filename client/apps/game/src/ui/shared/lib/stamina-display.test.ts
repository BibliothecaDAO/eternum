import { describe, expect, it } from "vitest";

import { resolveStaminaDisplay } from "./stamina-display";

describe("resolveStaminaDisplay", () => {
  it("uses displayRatio for the projected bar percentage when provided", () => {
    expect(resolveStaminaDisplay({ current: 90, max: 120, displayRatio: 110 / 120 })).toEqual({
      committedPercentage: 75,
      displayPercentage: 110 / 120 * 100,
      displayedCurrent: Math.round((110 / 120 * 100 / 100) * 120),
    });
  });

  it("uses projectedCurrent for the displayed value when provided", () => {
    expect(resolveStaminaDisplay({ current: 88, max: 120, projectedCurrent: 90 })).toEqual({
      committedPercentage: 73.33333333333333,
      displayPercentage: 73.33333333333333,
      displayedCurrent: 90,
    });
  });

  it("falls back to committed current when projection is unavailable", () => {
    expect(resolveStaminaDisplay({ current: 88, max: 120 })).toEqual({
      committedPercentage: 73.33333333333333,
      displayPercentage: 73.33333333333333,
      displayedCurrent: 88,
    });
  });

  it("displayPercentage never falls below committedPercentage", () => {
    const result = resolveStaminaDisplay({ current: 100, max: 120, displayRatio: 0.5 });
    expect(result.displayPercentage).toBeGreaterThanOrEqual(result.committedPercentage);
  });

  it("handles max=0 gracefully", () => {
    expect(resolveStaminaDisplay({ current: 50, max: 0 })).toEqual({
      committedPercentage: 0,
      displayPercentage: 0,
      displayedCurrent: 0,
    });
  });
});
