import { describe, expect, it } from "vitest";

import type { ProceduralUnitPoseDiagnostics } from "../procedural-unit-diagnostics";
import { createProceduralAnimationFrameAnnotations } from "./procedural-animation-annotations";

describe("procedural animation frame annotations", () => {
  it("creates stable numbered humanoid and equipment labels", () => {
    const annotations = createProceduralAnimationFrameAnnotations({
      diagnostics: createArcherDiagnostics(),
      elapsedSeconds: 1.45,
      expectedPhase: "aim",
      frameIndex: 87,
      issues: [],
      runtimePhase: "aim",
      view: { azimuthDegrees: 0, elevationDegrees: 7, id: "front", label: "Front" },
    });

    expect(annotations.header).toBe("ARCHER · F087 · FRONT");
    expect(annotations.markers.map(({ id }) => id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 13, 14, 15,
    ]);
    expect(annotations.markers.find(({ id }) => id === 4)?.value).toBe("83.3°");
    expect(annotations.metrics).toContainEqual({ label: "knee out/L L/R", value: "+0.00 / +0.00" });
    expect(annotations.metrics).toContainEqual({ label: "toe out L/R", value: "5.0° / 5.0°" });
    expect(annotations.metrics).toContainEqual({ label: "arrow/head", value: "0.049" });
    expect(annotations.segments.length).toBeGreaterThan(8);
  });

  it("labels horse contacts and joint angles", () => {
    const diagnostics = createArcherDiagnostics();
    diagnostics.kind = "horse";
    diagnostics.bow = null;
    diagnostics.humanoid = null;
    diagnostics.horse = {
      finite: true,
      gait: "walk",
      headWorld: [0, 2, 1],
      issues: [],
      legs: Object.fromEntries(
        ["frontLeft", "frontRight", "hindLeft", "hindRight"].map((hoofId, index) => [
          hoofId,
          {
            bendAlignment: 0.5,
            contact: index % 2 === 0 ? "stance" : "swing",
            hoofWorld: [index, 0, 0],
            jointAnglesDegrees: [145, 122],
            jointsWorld: [
              [index, 1, 0],
              [index, 0.6, 0.1],
              [index, 0.2, 0],
            ],
          },
        ]),
      ) as unknown as NonNullable<ProceduralUnitPoseDiagnostics["horse"]>["legs"],
      phase: 0.25,
      saddleWorld: [0, 1.5, 0],
      stanceHoofCount: 2,
    };

    const annotations = createProceduralAnimationFrameAnnotations({
      diagnostics,
      elapsedSeconds: 0.25,
      expectedPhase: "gait",
      frameIndex: 15,
      issues: [],
      runtimePhase: "gait",
      view: { azimuthDegrees: 90, elevationDegrees: 7, id: "right-profile", label: "Right profile" },
    });

    expect(annotations.markers.map(({ id }) => id)).toEqual([20, 21, 22, 23, 24, 25]);
    expect(annotations.angles).toHaveLength(8);
    expect(annotations.metrics).toContainEqual({ label: "stance", value: "2/4" });
  });

  it("labels naval motion, broadside, wake, and sink metrics", () => {
    const diagnostics = createArcherDiagnostics();
    diagnostics.kind = "boat";
    diagnostics.bow = null;
    diagnostics.humanoid = null;
    diagnostics.boat = {
      broadsidePhase: "fire",
      heave: 0.04,
      maximumHeave: 0.08,
      maximumPitchDegrees: 40,
      maximumRollDegrees: 48,
      muzzleCount: 4,
      pitchDegrees: 2.4,
      rollDegrees: -3.8,
      sinkProgress: 0,
      wakeStrength: 0.45,
    };

    const annotations = createProceduralAnimationFrameAnnotations({
      diagnostics,
      elapsedSeconds: 0.45,
      expectedPhase: "fire",
      frameIndex: 27,
      issues: [],
      runtimePhase: "fire",
      view: { azimuthDegrees: 90, elevationDegrees: 7, id: "right-profile", label: "Right profile" },
    });

    expect(annotations.metrics).toEqual([
      { label: "broadside", value: "fire" },
      { label: "muzzles", value: "4" },
      { label: "heave", value: "0.040m" },
      { label: "pitch", value: "2.4°" },
      { label: "roll", value: "-3.8°" },
      { label: "sink", value: "0%" },
      { label: "wake", value: "45%" },
    ]);
  });
});

function createArcherDiagnostics(): ProceduralUnitPoseDiagnostics {
  const joints = {
    ankleLeft: [-0.2, 0, 0],
    ankleRight: [0.2, 0, 0],
    chest: [0, 1.25, 0],
    elbowLeft: [-0.5, 1.35, 0],
    elbowRight: [0.5, 1.35, 0],
    head: [0, 1.7, 0],
    hipLeft: [-0.15, 0.9, 0],
    hipRight: [0.15, 0.9, 0],
    kneeLeft: [-0.18, 0.48, 0],
    kneeRight: [0.18, 0.48, 0],
    pelvis: [0, 0.9, 0],
    shoulderLeft: [-0.25, 1.5, 0],
    shoulderRight: [0.25, 1.5, 0],
    wristLeft: [-0.7, 1.4, 0],
    wristRight: [0.7, 1.4, 0],
  } as const;
  return {
    boat: null,
    bow: {
      arrowDirectionWorld: [0, 0, 1],
      arrowHeadClearance: 0.049,
      bowGripHandDistance: 0,
      bowGripHeadDistance: 0.432,
      drawGripHandDistance: 0,
      bowGripWorld: [-0.7, 1.4, 0],
      lowerTipWorld: [-0.7, 0.6, 0],
      nockJawDistance: 0.223,
      nockWorld: [0.65, 1.55, 0],
      previewArrowVisible: true,
      upperTipWorld: [-0.7, 2.2, 0],
    },
    crossbow: null,
    horse: null,
    humanoid: {
      arms: {
        left: {
          elbowDegrees: 83.3,
          forearmLength: 0.4,
          handHeadClearance: 0.2,
          solverSocketError: 0,
          upperArmLength: 0.4,
        },
        right: {
          elbowDegrees: 83.9,
          forearmLength: 0.4,
          handHeadClearance: 0.1,
          solverSocketError: 0,
          upperArmLength: 0.4,
        },
      },
      finite: true,
      feet: {
        left: {
          contact: "stance",
          forwardDot: 1,
          outwardProgressionDegrees: 5,
          position: joints.ankleLeft,
          progress: 0.5,
          rotation: [0, 0, 0, 1],
          toePosition: [-0.2, 0, 0.2],
        },
        right: {
          contact: "stance",
          forwardDot: 1,
          outwardProgressionDegrees: 5,
          position: joints.ankleRight,
          progress: 0.5,
          rotation: [0, 0, 0, 1],
          toePosition: [0.2, 0, 0.2],
        },
      },
      headRadius: 0.17,
      issues: [],
      jawAnchor: [0, 1.55, 0],
      joints,
      legs: {
        left: {
          bendDistance: 0.05,
          bendForwardDot: 1,
          frontalDeviationDegrees: 0.5,
          kneeDegrees: 171,
          lowerLegLength: 0.45,
          outwardDeviationRatio: 0.001,
          upperLegLength: 0.45,
        },
        right: {
          bendDistance: 0.05,
          bendForwardDot: 1,
          frontalDeviationDegrees: 0.4,
          kneeDegrees: 169,
          lowerLegLength: 0.45,
          outwardDeviationRatio: 0.001,
          upperLegLength: 0.45,
        },
      },
      palmInwardDot: { left: 0.8, right: 0.7 },
      phase: 0.25,
      rootPosition: [0, 0, 0],
      rotations: { chest: [0, 0, 0, 1], head: [0, 0, 0, 1], pelvis: [0, 0, 0, 1] },
      scale: 1,
      socketDrawGripRight: [0.65, 1.55, 0],
      solverWristTargets: { left: [-0.7, 1.4, 0], right: [0.7, 1.4, 0] },
      socketGrips: { left: [-0.7, 1.4, 0], right: [0.65, 1.55, 0] },
      socketHands: { left: [-0.7, 1.4, 0], right: [0.7, 1.4, 0] },
    },
    issues: [],
    kind: "archer",
    melee: null,
  };
}
