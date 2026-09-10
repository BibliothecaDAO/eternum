import { describe, expect, it } from "vitest";
import { resolveRewardNightAmount } from "./reward-lighting";

describe("chest day and night readability", () => {
  it("keeps daylight subdued and preserves the night glow across the midnight wrap", () => {
    expect(resolveRewardNightAmount(0)).toBe(1);
    expect(resolveRewardNightAmount(100)).toBe(1);
    expect(resolveRewardNightAmount(42)).toBe(0);
    expect(resolveRewardNightAmount(50)).toBe(0);
    expect(resolveRewardNightAmount(25)).toBeCloseTo(0.5);
    expect(resolveRewardNightAmount(75)).toBeCloseTo(0.5);
  });
});
