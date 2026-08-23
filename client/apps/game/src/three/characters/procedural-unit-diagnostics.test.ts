import { describe, expect, it } from "vitest";

import type { ProceduralCharacterPoseDiagnostics, ProceduralHumanoidJointId } from "./procedural-character-diagnostics";
import { resolveProceduralUnitPoseDiagnostics } from "./procedural-unit-diagnostics";

describe("procedural unit pose diagnostics", () => {
  it("measures bow and arrow clearance from the head", () => {
    const diagnostics = resolveProceduralUnitPoseDiagnostics({
      bow: {
        arrowDirectionWorld: [0, 0, 1],
        bowGripWorld: [0.4, 1.5, 0.4],
        lowerTipWorld: [0.4, 0.7, 0.4],
        nockWorld: [0.2, 1.5, 0],
        previewArrowVisible: true,
        upperTipWorld: [0.4, 2.3, 0.4],
      },
      humanoid: createHumanoidDiagnostics(),
      kind: "archer",
    });

    expect(diagnostics.bow?.bowGripHeadDistance).toBeGreaterThan(0.4);
    expect(diagnostics.bow?.nockJawDistance).toBeCloseTo(0.2, 3);
    expect(diagnostics.bow?.arrowHeadClearance).toBeGreaterThan(0);
    expect(diagnostics.bow?.bowGripHandDistance).toBe(0);
  });

  it("rejects a weapon arc that crosses its own shield while preserving both grips", () => {
    const humanoid = createHumanoidDiagnostics();
    humanoid.socketGrips = { left: [0.6, 1, 0], right: [0, 1, 0] };
    const diagnostics = resolveProceduralUnitPoseDiagnostics({
      humanoid,
      kind: "knight",
      melee: {
        offhandGripWorld: [0.6, 1, 0],
        offhandId: "round-shield",
        offhandSource: "procedural",
        offhandWorld: [0, 1, 0.5],
        weaponGripWorld: [0, 1, 0],
        weaponId: "iron-longsword",
        weaponSource: "procedural",
        weaponTipWorld: [0, 1, 1],
      },
    });

    expect(diagnostics.melee?.weaponGripHandDistance).toBe(0);
    expect(diagnostics.melee?.offhandGripHandDistance).toBe(0);
    expect(diagnostics.melee?.weaponOffhandClearance).toBeLessThan(0);
    expect(diagnostics.issues).toContain("weapon-intersects-offhand");
  });
});

function createHumanoidDiagnostics(): ProceduralCharacterPoseDiagnostics {
  const jointIds: ProceduralHumanoidJointId[] = [
    "ankleLeft",
    "ankleRight",
    "chest",
    "elbowLeft",
    "elbowRight",
    "head",
    "hipLeft",
    "hipRight",
    "kneeLeft",
    "kneeRight",
    "pelvis",
    "shoulderLeft",
    "shoulderRight",
    "wristLeft",
    "wristRight",
  ];
  const joints = Object.fromEntries(
    jointIds.map((id) => [id, id === "head" ? [0, 1.7, 0] : [0, 0, 0]]),
  ) as unknown as ProceduralCharacterPoseDiagnostics["joints"];
  return {
    arms: {
      left: {
        elbowDegrees: 90,
        forearmLength: 0.4,
        handHeadClearance: 0.2,
        solverSocketError: 0,
        upperArmLength: 0.4,
      },
      right: {
        elbowDegrees: 90,
        forearmLength: 0.4,
        handHeadClearance: 0.2,
        solverSocketError: 0,
        upperArmLength: 0.4,
      },
    },
    finite: true,
    feet: {
      left: {
        contact: "stance",
        forwardDot: 1,
        position: [0, 0, 0],
        progress: 0.5,
        rotation: [0, 0, 0, 1],
        toePosition: [0, 0, 0.2],
      },
      right: {
        contact: "stance",
        forwardDot: 1,
        position: [0, 0, 0],
        progress: 0.5,
        rotation: [0, 0, 0, 1],
        toePosition: [0, 0, 0.2],
      },
    },
    headRadius: 0.17,
    issues: [],
    jawAnchor: [0, 1.5, 0],
    joints,
    legs: {
      left: { bendDistance: 0.05, bendForwardDot: 1, kneeDegrees: 170, lowerLegLength: 0.5, upperLegLength: 0.5 },
      right: { bendDistance: 0.05, bendForwardDot: 1, kneeDegrees: 170, lowerLegLength: 0.5, upperLegLength: 0.5 },
    },
    palmInwardDot: { left: 1, right: 1 },
    phase: 0.25,
    rootPosition: [0, 0, 0],
    rotations: { chest: [0, 0, 0, 1], head: [0, 0, 0, 1], pelvis: [0, 0, 0, 1] },
    scale: 1,
    socketDrawGripRight: [0.2, 1.5, 0],
    solverWristTargets: { left: [0, 1, 0], right: [0, 1, 0] },
    socketGrips: { left: [0.4, 1.5, 0.4], right: [0.2, 1.5, 0] },
    socketHands: { left: [0, 1, 0], right: [0, 1, 0] },
  };
}
