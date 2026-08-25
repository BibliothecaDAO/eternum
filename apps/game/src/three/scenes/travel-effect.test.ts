import { describe, expect, it } from "vitest";
import { getMinEffectCleanupDelayMs } from "./travel-effect";

describe("getMinEffectCleanupDelayMs", () => {
  it("returns full minimum duration when cleanup is requested immediately", () => {
    expect(getMinEffectCleanupDelayMs(1000, 1000, 600)).toBe(600);
  });

  it("returns remaining delay when part of the minimum duration has elapsed", () => {
    expect(getMinEffectCleanupDelayMs(1000, 1300, 600)).toBe(300);
  });

  it("returns zero when minimum duration has already elapsed", () => {
    expect(getMinEffectCleanupDelayMs(1000, 1700, 600)).toBe(0);
  });

  it("returns zero for non-positive minimum duration", () => {
    expect(getMinEffectCleanupDelayMs(1000, 1200, 0)).toBe(0);
    expect(getMinEffectCleanupDelayMs(1000, 1200, -5)).toBe(0);
  });
});
