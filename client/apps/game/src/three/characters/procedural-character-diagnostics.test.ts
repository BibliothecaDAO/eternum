import { Group } from "three";
import { describe, expect, it } from "vitest";

import { createDefaultProceduralCharacterConfig } from "./procedural-character-config";
import { resolveProceduralCharacterPoseDiagnostics } from "./procedural-character-diagnostics";
import { resolveProceduralCharacterPose } from "./procedural-character-pose";
import { resolveCharacterRig } from "./procedural-character-rig";

describe("procedural character pose diagnostics", () => {
  it("names the solver joints and reports finite arm geometry", () => {
    const config = createDefaultProceduralCharacterConfig();
    const rig = resolveCharacterRig(config);
    const pose = resolveProceduralCharacterPose(rig, config, 0);
    const diagnostics = resolveProceduralCharacterPoseDiagnostics({
      leftPalmInwardDot: 1,
      pose,
      rig,
      rightPalmInwardDot: 1,
      root: new Group(),
    });

    expect(diagnostics.finite).toBe(true);
    expect(Object.keys(diagnostics.joints)).toHaveLength(15);
    expect(diagnostics.arms.left.upperArmLength).toBeCloseTo(rig.morphology.upperArmLength, 2);
    expect(diagnostics.arms.right.forearmLength).toBeCloseTo(rig.morphology.forearmLength, 2);
    expect(diagnostics.arms.left.elbowDegrees).toBeGreaterThan(8);
    expect(diagnostics.arms.right.elbowDegrees).toBeLessThan(174);
    expect(diagnostics.legs.left.kneeDegrees).toBeGreaterThan(0);
    expect(diagnostics.legs.left.bendForwardDot).toBeGreaterThan(0);
    expect(diagnostics.legs.left.frontalDeviationDegrees).toBeLessThan(1);
    expect(Math.abs(diagnostics.legs.left.outwardDeviationRatio)).toBeLessThan(0.01);
    expect(diagnostics.legs.right.lowerLegLength).toBeGreaterThan(0);
    expect(diagnostics.phase).toBeGreaterThanOrEqual(0);
    expect(diagnostics.phase).toBeLessThan(1);
    diagnostics.feet.left.position.forEach((value, index) =>
      expect(value).toBeCloseTo(pose.feet.left.target[index], 3),
    );
    expect(diagnostics.issues).toEqual([]);
  });

  it("measures each foot's outward progression in the character frame", () => {
    const config = createDefaultProceduralCharacterConfig();
    const rig = resolveCharacterRig(config);
    const pose = resolveProceduralCharacterPose(rig, config, 0);
    const toeOutRadians = (5 * Math.PI) / 180;
    const toeOffset = [Math.sin(toeOutRadians) * 0.2, 0, Math.cos(toeOutRadians) * 0.2] as const;
    const diagnostics = resolveProceduralCharacterPoseDiagnostics({
      leftPalmInwardDot: 1,
      pose,
      rig,
      rightPalmInwardDot: 1,
      root: new Group(),
      sockets: {
        footFacing: {
          left: {
            forwardDot: Math.cos(toeOutRadians),
            toePosition: add(pose.feet.left.target, toeOffset),
          },
          right: {
            forwardDot: Math.cos(toeOutRadians),
            toePosition: add(pose.feet.right.target, [-toeOffset[0], 0, toeOffset[2]]),
          },
        },
      },
    });

    expect(diagnostics.feet.left.outwardProgressionDegrees).toBeCloseTo(5, 2);
    expect(diagnostics.feet.right.outwardProgressionDegrees).toBeCloseTo(5, 2);
  });

  it("distinguishes forward-bending knees from backward-facing feet", () => {
    const config = createDefaultProceduralCharacterConfig();
    const rig = resolveCharacterRig(config);
    const pose = resolveProceduralCharacterPose(rig, config, 0);
    const diagnostics = resolveProceduralCharacterPoseDiagnostics({
      leftPalmInwardDot: 1,
      pose,
      rig,
      rightPalmInwardDot: 1,
      root: new Group(),
      sockets: {
        footFacing: {
          left: { forwardDot: -1, toePosition: [-0.2, 0, -0.3] },
          right: { forwardDot: -1, toePosition: [0.2, 0, -0.3] },
        },
      },
    });

    expect(diagnostics.legs.left.bendForwardDot).toBeGreaterThan(0);
    expect(diagnostics.legs.right.bendForwardDot).toBeGreaterThan(0);
    expect(diagnostics.issues).toEqual(["left-foot-backward", "right-foot-backward"]);
  });
});

function add(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): [number, number, number] {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}
