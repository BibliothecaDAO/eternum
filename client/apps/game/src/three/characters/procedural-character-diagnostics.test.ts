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
    expect(diagnostics.legs.right.lowerLegLength).toBeGreaterThan(0);
    expect(diagnostics.phase).toBeGreaterThanOrEqual(0);
    expect(diagnostics.phase).toBeLessThan(1);
    diagnostics.feet.left.position.forEach((value, index) =>
      expect(value).toBeCloseTo(pose.feet.left.target[index], 3),
    );
    expect(diagnostics.issues).toEqual([]);
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
