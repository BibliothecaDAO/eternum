import { describe, expect, it } from "vitest";
import { resolveStormVisualPolicy } from "./storm-visual-policy";
import type { AtmosphereSnapshot } from "./atmosphere-controller";

function createSnapshot(overrides: Partial<AtmosphereSnapshot> = {}): AtmosphereSnapshot {
  return {
    cycleProgress: 50,
    fogFactor: 0,
    intensity: 0,
    rainIntensity: 0,
    skyDarkness: 0,
    stormIntensity: 0,
    sunOcclusion: 0,
    timeOfDay: "day",
    weatherPhase: "clear",
    weatherType: "clear",
    windDirection: { x: 1, y: 0 },
    windSpeed: 0,
    ...overrides,
  };
}

describe("resolveStormVisualPolicy", () => {
  it("disables storm fill and lightning for clear weather", () => {
    expect(
      resolveStormVisualPolicy({
        hasScheduledLightning: false,
        lightningActive: false,
        snapshot: createSnapshot(),
        timeSinceLastLightningMs: 10_000,
      }),
    ).toEqual({
      allowLightning: false,
      allowStormFill: false,
      ambientFlicker: 1,
      hemisphereFlicker: 1,
      shouldScheduleLightning: false,
      stormFillIntensity: 0,
    });
  });

  it("keeps rain from scheduling lightning until the snapshot is semantically storm", () => {
    const result = resolveStormVisualPolicy({
      hasScheduledLightning: false,
      lightningActive: false,
      snapshot: createSnapshot({
        intensity: 0.7,
        rainIntensity: 0.7,
        weatherPhase: "peak",
        weatherType: "rain",
      }),
      timeSinceLastLightningMs: 10_000,
    });

    expect(result.allowStormFill).toBe(false);
    expect(result.allowLightning).toBe(false);
    expect(result.shouldScheduleLightning).toBe(false);
  });

  it("allows a storm snapshot to schedule lightning only when no sequence is already active", () => {
    const snapshot = createSnapshot({
      fogFactor: 0.6,
      intensity: 0.9,
      rainIntensity: 1,
      skyDarkness: 0.8,
      stormIntensity: 0.85,
      sunOcclusion: 0.7,
      weatherPhase: "peak",
      weatherType: "storm",
    });

    const result = resolveStormVisualPolicy({
      hasScheduledLightning: false,
      lightningActive: false,
      snapshot,
      timeSinceLastLightningMs: 10_000,
    });

    expect(result.allowStormFill).toBe(true);
    expect(result.allowLightning).toBe(true);
    expect(result.shouldScheduleLightning).toBe(true);
    expect(result.stormFillIntensity).toBeGreaterThan(0);
    expect(result.ambientFlicker).toBeGreaterThan(1);
    expect(result.hemisphereFlicker).toBeGreaterThan(1);
  });
});
