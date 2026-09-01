import { describe, expect, it } from "vitest";

import { resolveHorseRigRequiredBoneNames, validateHorseRigAdapter } from "./horse-rig-adapter";
import { resolveHorseRigAdapter } from "./horse-rig-adapters";
import { QUATERNIUS_HORSE_RIG_ADAPTER } from "./quaternius-horse-rig-adapter";

describe("horse rig adapter", () => {
  it("maps every axial, leg, hoof, target, neck, tail, and saddle role", () => {
    const adapter = QUATERNIUS_HORSE_RIG_ADAPTER;
    const requiredBones = resolveHorseRigRequiredBoneNames(adapter);

    expect(validateHorseRigAdapter(adapter)).toEqual([]);
    expect(adapter.legs.frontLeft.segments).toEqual(["frontShoulderLeft", "frontUpperLeft", "frontLowerLeft"]);
    expect(adapter.legs.hindRight.hoof).toBe("FFBR");
    expect(adapter.neck).toEqual(["Neck1", "Neck2", "Neck3"]);
    expect(adapter.saddle.offset).toEqual([0, 0.34, -0.12]);
    expect(requiredBones).toEqual(expect.arrayContaining(["Body", "Torso3", "IKFrontLegL", "Tail7"]));
    expect(resolveHorseRigAdapter("quaternius-horse")).toBe(adapter);
  });

  it("rejects incomplete limb chains and invalid saddle definitions", () => {
    expect(
      validateHorseRigAdapter({
        ...QUATERNIUS_HORSE_RIG_ADAPTER,
        legs: {
          ...QUATERNIUS_HORSE_RIG_ADAPTER.legs,
          frontLeft: { ...QUATERNIUS_HORSE_RIG_ADAPTER.legs.frontLeft, bones: ["FrontShoulderL"] },
        },
      }),
    ).toContain("leg-segment-count-mismatch:frontLeft");
    expect(
      validateHorseRigAdapter({
        ...QUATERNIUS_HORSE_RIG_ADAPTER,
        saddle: { ...QUATERNIUS_HORSE_RIG_ADAPTER.saddle, offset: [0, Number.NaN, 0] },
      }),
    ).toContain("invalid-saddle-offset");
    expect(() => resolveHorseRigAdapter("missing" as never)).toThrow('Unknown horse rig adapter "missing"');
  });
});
