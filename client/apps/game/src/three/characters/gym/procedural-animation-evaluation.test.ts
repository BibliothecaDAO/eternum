import { describe, expect, it } from "vitest";

import type { ProceduralAnimationCaptureResult } from "./procedural-animation-capture";
import { evaluateProceduralAnimationCapture } from "./procedural-animation-evaluation";

describe("procedural animation objective evaluation", () => {
  it("measures hard gates and consecutive stance drift", () => {
    const result = createEvaluationResult();
    const evaluation = evaluateProceduralAnimationCapture(result);

    expect(evaluation.automatedHardGatePassed).toBe(true);
    expect(evaluation.locomotionHardGatePassed).toBeNull();
    expect(evaluation.temporalCoverage).toBe(true);
    expect(evaluation.measurements.maximumStanceContactDrift).toBeCloseTo(0.01, 4);
    expect(evaluation.measurements.maximumSocketDivergence).toBe(0.02);
    expect(evaluation.measurements.elbowDegrees).toEqual({ maximum: 100, minimum: 80 });
  });

  it("fails the hard gate for a blank or semantically invalid view", () => {
    const result = createEvaluationResult();
    result.frames[1].issues = ["right-solver-socket-diverged"];
    result.frames[1].views[0].imageNonBlank = false;

    const evaluation = evaluateProceduralAnimationCapture(result);
    expect(evaluation.automatedHardGatePassed).toBe(false);
    expect(evaluation.blankViewCount).toBe(1);
    expect(evaluation.issueFrameCount).toBe(1);
  });

  it("requires translating temporal evidence before a humanoid gait can pass", () => {
    const result = createEvaluationResult();
    result.plan.sequence = "locomotion-cycle";
    result.plan.rootMotionSpeed = 0;

    const evaluation = evaluateProceduralAnimationCapture(result);
    expect(evaluation.locomotionHardGatePassed).toBe(false);
    expect(evaluation.automatedHardGatePassed).toBe(false);
    expect(evaluation.locomotionHardGateFailures).toContain("moving-root-capture-required");
  });

  it("measures and rejects a one-frame planted-foot rotation", () => {
    const result = createEvaluationResult();
    result.plan.sequence = "locomotion-cycle";
    result.plan.rootMotionSpeed = 0.72;
    result.frames[1].diagnostics.humanoid!.feet.left.rotation = [0, 0, 1, 0];

    const evaluation = evaluateProceduralAnimationCapture(result);

    expect(evaluation.measurements.maximumFootAngularStepDegrees).toBe(180);
    expect(evaluation.locomotionHardGateFailures).toContain("foot-angular-pop");
    expect(evaluation.locomotionHardGateFailures).toContain("stance-foot-rotation");
  });
});

function createEvaluationResult(): ProceduralAnimationCaptureResult & {
  frames: Array<
    ProceduralAnimationCaptureResult["frames"][number] & { issues: string[]; views: Array<{ imageNonBlank: boolean }> }
  >;
} {
  const frames = [0, 1].map((frameIndex) => ({
    diagnostics: {
      bow: null,
      crossbow: null,
      horse: null,
      humanoid: {
        arms: {
          left: {
            elbowDegrees: 80 + frameIndex * 10,
            forearmLength: 0.4,
            handHeadClearance: 0.2,
            solverSocketError: 0.01 + frameIndex * 0.01,
            upperArmLength: 0.4,
          },
          right: {
            elbowDegrees: 90 + frameIndex * 10,
            forearmLength: 0.4,
            handHeadClearance: 0.2,
            solverSocketError: 0.01,
            upperArmLength: 0.4,
          },
        },
        feet: {
          left: { contact: "stance", position: [frameIndex * 0.01, 0, 0], progress: 0.5, rotation: [0, 0, 0, 1] },
          right: { contact: "stance", position: [0, 0, 0], progress: 0.5, rotation: [0, 0, 0, 1] },
        },
        finite: true,
        headRadius: 0.17,
        issues: [],
        jawAnchor: null,
        joints: {
          ankleLeft: [frameIndex * 0.01, 0, 0],
          ankleRight: [0, 0, 0],
          chest: [0, 1.2, 0],
          elbowLeft: [0, 1, 0],
          elbowRight: [0, 1, 0],
          head: [0, 1.7, 0],
          hipLeft: [0, 0.8, 0],
          hipRight: [0, 0.8, 0],
          kneeLeft: [0, 0.4, 0],
          kneeRight: [0, 0.4, 0],
          pelvis: [0, 0.8, 0],
          shoulderLeft: [0, 1.4, 0],
          shoulderRight: [0, 1.4, 0],
          wristLeft: [0, 1, 0],
          wristRight: [0, 1, 0],
        },
        legs: {
          left: { kneeDegrees: 120, lowerLegLength: 0.4, upperLegLength: 0.4 },
          right: { kneeDegrees: 125, lowerLegLength: 0.4, upperLegLength: 0.4 },
        },
        palmInwardDot: { left: 1, right: 1 },
        phase: frameIndex * 0.1,
        rootPosition: [0, 0, frameIndex * 0.01],
        rotations: {
          chest: [0, 0, 0, 1],
          head: [0, 0, 0, 1],
          pelvis: [0, 0, 0, 1],
        },
        scale: 1,
        socketDrawGripRight: [0, 1, 0],
        socketGrips: { left: [0, 1, 0], right: [0, 1, 0] },
        socketHands: { left: [0, 1, 0], right: [0, 1, 0] },
        solverWristTargets: { left: [0, 1, 0], right: [0, 1, 0] },
      },
      issues: [],
      kind: "knight",
      melee: null,
    },
    elapsedSeconds: frameIndex / 60,
    expectedPhase: "gait",
    frameIndex,
    imageDataUrl: null,
    imageNonBlank: true,
    issues: [] as string[],
    runtimePhase: "gait",
    views: [{ imageNonBlank: true }],
  }));
  return {
    config: {} as ProceduralAnimationCaptureResult["config"],
    frames,
    plan: { sampling: "all-frames", sequence: "melee-attack" } as ProceduralAnimationCaptureResult["plan"],
  } as unknown as ReturnType<typeof createEvaluationResult>;
}
