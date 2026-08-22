import { describe, expect, it } from "vitest";

import { applyProceduralArcherConfigPatch, createDefaultProceduralArcherConfig } from "./procedural-archer-config";

describe("procedural archer configuration", () => {
  it("normalizes timing, collision, target, and pool limits", () => {
    const config = applyProceduralArcherConfigPatch(createDefaultProceduralArcherConfig(), {
      aimPitchDegrees: 90,
      bowArmExtension: 2,
      bowGripHeight: -1,
      bowGripSide: 2,
      drawSeconds: -1,
      projectileCapacity: 1,
      projectileFixedStep: 1,
      projectileSweepRadius: 0,
      targetDistance: 100,
      volleyCount: 99,
    });

    expect(config.aimPitchDegrees).toBe(45);
    expect(config.bowArmExtension).toBe(0.82);
    expect(config.bowGripHeight).toBe(0.05);
    expect(config.bowGripSide).toBe(0.45);
    expect(config.drawSeconds).toBe(0.1);
    expect(config.projectileCapacity).toBe(16);
    expect(config.projectileFixedStep).toBeCloseTo(1 / 30);
    expect(config.projectileSweepRadius).toBe(0.005);
    expect(config.targetDistance).toBe(12);
    expect(config.volleyCount).toBe(12);
  });
});
