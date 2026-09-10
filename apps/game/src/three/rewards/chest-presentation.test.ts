import { describe, expect, it } from "vitest";
import { resolveChestNightAmount } from "./chest-presentation";

describe("chest day and night readability", () => {
  it("keeps daylight subdued and preserves the night glow across the midnight wrap", () => {
    expect(resolveChestNightAmount(0)).toBe(1);
    expect(resolveChestNightAmount(100)).toBe(1);
    expect(resolveChestNightAmount(42)).toBe(0);
    expect(resolveChestNightAmount(50)).toBe(0);
    expect(resolveChestNightAmount(25)).toBeCloseTo(0.5);
    expect(resolveChestNightAmount(75)).toBeCloseTo(0.5);
  });
});
