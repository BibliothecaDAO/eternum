import { describe, expect, it } from "vitest";

import { applyProceduralBoatConfigPatch, createDefaultProceduralBoatConfig } from "./procedural-boat-config";

describe("procedural boat config", () => {
  it("creates a useful deterministic sailing broadside", () => {
    const config = createDefaultProceduralBoatConfig();

    expect(config.motionMode).toBe("sail");
    expect(config.broadsideCannons).toBeGreaterThan(1);
    expect(config.sinkSeconds).toBeGreaterThan(config.recoilSeconds);
    expect(config.seed).toBeGreaterThan(0);
  });

  it("normalizes unsafe gym patches at the shared boundary", () => {
    const config = applyProceduralBoatConfigPatch(createDefaultProceduralBoatConfig(), {
      broadsideCannons: 100,
      projectileFlightSeconds: Number.NaN,
      sinkRollDegrees: 500,
      speed: -20,
      tier: 8 as 3,
    });

    expect(config.broadsideCannons).toBe(6);
    expect(config.projectileFlightSeconds).toBe(0.25);
    expect(config.sinkRollDegrees).toBe(55);
    expect(config.speed).toBe(0);
    expect(config.tier).toBe(3);
  });
});
