import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import { createDefaultProceduralArcherConfig } from "./procedural-archer-config";
import { resolveProceduralArcherAim } from "./procedural-archer-aim";

describe("procedural archer aim", () => {
  it("aims down local forward and clamps unreachable torso angles", () => {
    const config = { ...createDefaultProceduralArcherConfig(), aimPitchDegrees: 0, aimYawDegrees: 0 };
    const forward = resolveProceduralArcherAim(new Vector3(0, 0, 5), config);
    const clamped = resolveProceduralArcherAim(new Vector3(10, 10, 0.01), config);

    expect(forward.direction.toArray()).toEqual([0, 0, 1]);
    expect(clamped.yawRadians).toBeCloseTo((50 * Math.PI) / 180);
    expect(clamped.pitchRadians).toBeCloseTo((45 * Math.PI) / 180);
    expect(clamped.direction.length()).toBeCloseTo(1);
  });
});
