import { describe, expect, it } from "vitest";

import {
  applyProceduralCharacterConfigPatch,
  createDefaultProceduralCharacterConfig,
  type ProceduralCharacterMotionMode,
} from "./procedural-character-config";
import { resolveProceduralCharacterPose } from "./procedural-character-pose";
import { resolveCharacterRig } from "./procedural-character-rig";

describe("procedural character locomotion", () => {
  it("rises over walking mid-stance and compresses before running flight", () => {
    const walkDoubleSupport = pelvisPosition("walk", 0);
    const walkMidStance = pelvisPosition("walk", 0.25);
    const runMidStance = pelvisPosition("run", 0.21);
    const runFlight = pelvisPosition("run", 0.46);

    expect(walkMidStance[1]).toBeGreaterThan(walkDoubleSupport[1] + 0.03);
    expect(runFlight[1]).toBeGreaterThan(runMidStance[1] + 0.04);
  });

  it("keeps running weight transfer narrower than walking weight transfer", () => {
    const walkExcursion = pelvisLateralExcursion("walk");
    const runExcursion = pelvisLateralExcursion("run");

    expect(runExcursion).toBeLessThan(walkExcursion * 0.75);
  });
});

function pelvisPosition(mode: ProceduralCharacterMotionMode, phase: number): readonly [number, number, number] {
  const config = createEvaluationConfig(mode);
  return resolveProceduralCharacterPose(resolveCharacterRig(config), config, 0, undefined, phase).parts.pelvis.position;
}

function pelvisLateralExcursion(mode: ProceduralCharacterMotionMode): number {
  const positions = Array.from({ length: 200 }, (_, index) => pelvisPosition(mode, index / 200)[0]);
  return Math.max(...positions) - Math.min(...positions);
}

function createEvaluationConfig(mode: ProceduralCharacterMotionMode) {
  return applyProceduralCharacterConfigPatch(createDefaultProceduralCharacterConfig(), {
    animationMode: mode,
    breathing: 0,
    motionVariation: 0,
  });
}
