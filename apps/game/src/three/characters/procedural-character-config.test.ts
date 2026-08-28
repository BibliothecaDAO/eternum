import { describe, expect, it, vi } from "vitest";

import {
  applyProceduralCharacterConfigPatch,
  createDefaultProceduralCharacterConfig,
  resolveProceduralCharacterPreset,
} from "./procedural-character-config";
import { isProceduralCharacterPoseFinite, resolveProceduralCharacterPose } from "./procedural-character-pose";
import { resolveCharacterRig } from "./procedural-character-rig";

describe("procedural character configuration", () => {
  it("normalizes unsafe parameter edits at the configuration seam", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const config = applyProceduralCharacterConfigPatch(createDefaultProceduralCharacterConfig(), {
      appearanceId: "unknown-family" as "modular-fantasy",
      tier: 99 as 1,
      seed: -4,
      primaryColor: "not-a-color",
      fixedStep: 1,
      collisionSteps: 20,
      elbowMinDegrees: 80,
      elbowMaxDegrees: 20,
      dutyFactorOffset: 1,
      footPlant: -2,
      footProgressionDegrees: 100,
      motionVariation: 10,
      secondaryMotion: 10,
      stepWidthRatio: 10,
    });

    expect(config.tier).toBe(3);
    expect(config.appearanceId).toBe("modular-fantasy");
    expect(config.seed).toBe(0);
    expect(config.primaryColor).toBe("#315f86");
    expect(config.fixedStep).toBeCloseTo(1 / 30);
    expect(config.collisionSteps).toBe(4);
    expect(config.elbowMaxDegrees).toBe(81);
    expect(config.dutyFactorOffset).toBe(0.16);
    expect(config.footPlant).toBe(0);
    expect(config.footProgressionDegrees).toBe(25);
    expect(config.motionVariation).toBe(0.3);
    expect(config.secondaryMotion).toBe(1.5);
    expect(config.stepWidthRatio).toBe(0.3);
    warning.mockRestore();
  });

  it("resolves deterministic morphology and finite poses", () => {
    const config = resolveProceduralCharacterPreset("mythic");
    const firstRig = resolveCharacterRig(config);
    const secondRig = resolveCharacterRig(config);
    const pose = resolveProceduralCharacterPose(firstRig, config, 1.75);

    expect(firstRig.morphology).toEqual(secondRig.morphology);
    expect(isProceduralCharacterPoseFinite(pose)).toBe(true);
    expect(pose.parts.head.position[1]).toBeGreaterThan(pose.parts.pelvis.position[1]);
    expect(pose.parts.shinLeft.position).not.toEqual(pose.parts.shinRight.position);
    expect(pose.feet.left.target).not.toEqual(pose.feet.right.target);
  });

  it("plants stance ankles and lifts only the swing ankle", () => {
    const config = applyProceduralCharacterConfigPatch(createDefaultProceduralCharacterConfig(), {
      animationMode: "walk",
      motionVariation: 0,
      seed: 0,
    });
    const rig = resolveCharacterRig(config);
    const poses = Array.from({ length: 120 }, (_, index) => resolveProceduralCharacterPose(rig, config, index / 120));
    const stanceFeet = poses.flatMap((pose) =>
      Object.values(pose.feet).filter((foot) => foot.cycle.contact === "stance"),
    );
    const swingFeet = poses.flatMap((pose) =>
      Object.values(pose.feet).filter((foot) => foot.cycle.contact === "swing"),
    );

    expect(stanceFeet.every((foot) => Math.abs(foot.target[1] - 0.12) < 1e-5)).toBe(true);
    expect(swingFeet.some((foot) => foot.target[1] > 0.2)).toBe(true);
  });

  it("places walking feet at the configured width relative to leg length", () => {
    const config = applyProceduralCharacterConfigPatch(createDefaultProceduralCharacterConfig(), {
      animationMode: "walk",
      hipSway: 0,
      motionVariation: 0,
      stepWidthRatio: 0.13,
    });
    const rig = resolveCharacterRig(config);
    const pose = resolveProceduralCharacterPose(rig, config, 0);
    const footSeparation = Math.abs(pose.feet.left.target[0] - pose.feet.right.target[0]);
    const legLength = rig.morphology.thighLength + rig.morphology.shinLength;

    expect(footSeparation / legLength).toBeCloseTo(0.13, 4);
  });

  it("bends knees and elbows toward the character's authored +Z facing direction", () => {
    const config = applyProceduralCharacterConfigPatch(createDefaultProceduralCharacterConfig(), {
      animationMode: "idle",
      armSwing: 0,
      bob: 0,
      breathing: 0,
      hipSway: 0,
      lean: 0,
      stepHeight: 0,
      stride: 0,
      torsoTwist: 0,
    });
    const pose = resolveProceduralCharacterPose(resolveCharacterRig(config), config, 0);

    expect({
      leftElbow: endpointZ(pose.parts.forearmLeft.position, pose.parts.forearmLeft.jointAnchor) > 0,
      leftKnee: endpointZ(pose.parts.shinLeft.position, pose.parts.shinLeft.jointAnchor) < 0,
      rightElbow: endpointZ(pose.parts.forearmRight.position, pose.parts.forearmRight.jointAnchor) > 0,
      rightKnee: endpointZ(pose.parts.shinRight.position, pose.parts.shinRight.jointAnchor) < 0,
    }).toEqual({
      leftElbow: true,
      leftKnee: true,
      rightElbow: true,
      rightKnee: true,
    });
  });

  it("resolves a finite seated rider pose with knees outside the pelvis", () => {
    const config = applyProceduralCharacterConfigPatch(createDefaultProceduralCharacterConfig(), {
      animationMode: "mounted",
    });
    const pose = resolveProceduralCharacterPose(resolveCharacterRig(config), config, 0.5);

    expect(isProceduralCharacterPoseFinite(pose)).toBe(true);
    expect(Math.abs(pose.parts.shinLeft.jointAnchor[0])).toBeGreaterThan(Math.abs(pose.parts.thighLeft.jointAnchor[0]));
    expect(Math.abs(pose.parts.shinRight.jointAnchor[0])).toBeGreaterThan(
      Math.abs(pose.parts.thighRight.jointAnchor[0]),
    );
  });
});

function endpointZ(midpoint: readonly [number, number, number], joint: readonly [number, number, number]): number {
  return midpoint[2] * 2 - joint[2];
}
