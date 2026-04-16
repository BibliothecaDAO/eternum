import { describe, expect, it } from "vitest";

import { resolveStaminaDisplay } from "./stamina-display";

describe("resolveStaminaDisplay", () => {
  it("computes percentage and displayed value from current and max", () => {
    expect(resolveStaminaDisplay({ current: 90, max: 120 })).toEqual({
      committedPercentage: 75,
      displayPercentage: 75,
      displayedCurrent: 90,
    });
  });

  it("handles full stamina", () => {
    expect(resolveStaminaDisplay({ current: 120, max: 120 })).toEqual({
      committedPercentage: 100,
      displayPercentage: 100,
      displayedCurrent: 120,
    });
  });

  it("handles max=0 gracefully", () => {
    expect(resolveStaminaDisplay({ current: 50, max: 0 })).toEqual({
      committedPercentage: 0,
      displayPercentage: 0,
      displayedCurrent: 50,
    });
  });

  it("clamps percentage to 100", () => {
    const result = resolveStaminaDisplay({ current: 130, max: 120 });
    expect(result.committedPercentage).toBe(100);
    expect(result.displayPercentage).toBe(100);
  });
});
