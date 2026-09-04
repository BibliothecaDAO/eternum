import { describe, expect, it } from "vitest";

import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { applyCharacterRigLimbLengths, resolveCharacterRig } from "./procedural-character-rig";

describe("procedural character rig", () => {
  it("calibrates solver arm lengths without mutating the seeded base rig", () => {
    const base = resolveCharacterRig(createDefaultProceduralCharacterConfig());
    const originalLegLength = base.morphology.thighLength + base.morphology.shinLength;
    const calibrated = applyCharacterRigLimbLengths(base, {
      forearmLength: 0.31,
      shinLength: 0.56,
      thighLength: 0.52,
      upperArmLength: 0.34,
    });

    expect(calibrated.morphology.forearmLength).toBe(0.31);
    expect(calibrated.morphology.upperArmLength).toBe(0.34);
    expect(calibrated.parts.forearmLeft.length).toBe(0.31);
    expect(calibrated.parts.upperArmRight.length).toBe(0.34);
    expect(calibrated.morphology.thighLength + calibrated.morphology.shinLength).toBeCloseTo(originalLegLength, 8);
    expect(calibrated.morphology.thighLength / calibrated.morphology.shinLength).toBeCloseTo(0.52 / 0.56, 8);
    expect(base.morphology.forearmLength).not.toBe(0.31);
  });
});
