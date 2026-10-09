import { describe, expect, it } from "vitest";

import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { applyCharacterRigLimbLengths, resolveCharacterRig } from "./procedural-character-rig";

describe("procedural character rig", () => {
  it("calibrates solver arm lengths without mutating the seeded base rig", () => {
    const base = resolveCharacterRig(createDefaultProceduralCharacterConfig());
    const originalLegLength = base.morphology.thighLength + base.morphology.shinLength;
    const calibrated = applyCharacterRigLimbLengths(base, {
      foot: base.morphology.foot,
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

  it("fits positive source-body dimensions and rejects invalid measurements", () => {
    const base = resolveCharacterRig(createDefaultProceduralCharacterConfig());
    const measured = {
      foot: base.morphology.foot,
      forearmLength: 0.08,
      shinLength: 0.147,
      thighLength: 0.134,
      upperArmLength: 0.09,
      body: {
        headRadius: 0.066,
        shoulderWidth: 0.151,
        hipWidth: 0.084,
        pelvisToChest: 0.158,
        chestToNeck: 0.023,
        pelvisHeight: 0.316,
      },
    };
    const fitted = applyCharacterRigLimbLengths(base, measured);
    expect(fitted.morphology.shoulderWidth).toBeCloseTo(measured.body.shoulderWidth);
    expect(fitted.morphology.thighLength).toBeCloseTo(measured.thighLength);
    expect(fitted.parts.chest.halfExtents?.[1]).toBeCloseTo(measured.body.chestToNeck);
    expect(fitted.morphology.restPelvisHeight).toBe(measured.body.pelvisHeight);
    // The pose controller sizes its offsets by scale, so a figure a quarter of nominal size must say so.
    const rigLegLength = base.morphology.thighLength + base.morphology.shinLength;
    expect(fitted.morphology.scale).toBeCloseTo(
      base.morphology.scale * ((measured.thighLength + measured.shinLength) / rigLegLength),
    );
    expect(applyCharacterRigLimbLengths(base, { ...measured, body: undefined }).morphology.scale).toBe(
      base.morphology.scale,
    );
    for (const body of [
      { ...measured.body, hipWidth: 0 },
      { ...measured.body, chestToNeck: -0.01 },
      { ...measured.body, shoulderWidth: Number.NaN },
      { ...measured.body, pelvisToChest: Number.POSITIVE_INFINITY },
      { ...measured.body, pelvisHeight: 0 },
    ]) {
      expect(() => applyCharacterRigLimbLengths(base, { ...measured, body })).toThrow("Invalid source body morphology");
    }
  });
});
