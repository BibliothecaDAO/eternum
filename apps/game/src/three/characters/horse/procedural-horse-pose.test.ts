import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { createDefaultProceduralHorseConfig } from "./procedural-horse-config";
import {
  isProceduralHorsePoseFinite,
  resolveProceduralHorsePose,
  sampleProceduralHorseTerrain,
  solveFabrikChain,
} from "./procedural-horse-pose";
import type { ResolvedHorseRig } from "./procedural-horse-rig";

describe("procedural horse pose", () => {
  it("keeps every gait finite and preserves the authored bend hemisphere", () => {
    for (const gait of ["idle", "walk", "trot", "canter", "gallop"] as const) {
      const pose = resolveProceduralHorsePose(TEST_RIG, { ...createDefaultProceduralHorseConfig(), gait }, 0.37, 1.4);
      expect(isProceduralHorsePoseFinite(pose)).toBe(true);
      for (const [hoofId, leg] of Object.entries(pose.legs)) {
        expect(leg.bendAlignment, `${gait}:${hoofId}`).toBeGreaterThan(-0.05);
      }
    }
  });

  it("plants stance hooves and lifts swing hooves above sampled terrain", () => {
    const config = { ...createDefaultProceduralHorseConfig(), gait: "walk" as const, stepHeight: 0.35 };
    const pose = resolveProceduralHorsePose(TEST_RIG, config, 0.1, 0.1, () => ({ height: 0.2 }));
    for (const leg of Object.values(pose.legs)) {
      expect(leg.hoofTarget[1]).toBeGreaterThanOrEqual(0.2 - 1e-6);
      if (leg.cycle.contact === "swing") expect(leg.hoofTarget[1]).toBeGreaterThan(0.2);
    }
  });

  it("solves reachable chains to the requested endpoint without changing segment lengths", () => {
    const preferred = [new Vector3(0, 2, 0), new Vector3(0, 1.3, 0.3), new Vector3(0, 0.5, 0)];
    const target = new Vector3(0, 0.65, 0.55);
    const solved = solveFabrikChain(preferred, target);

    expect(solved.at(-1)?.distanceTo(target)).toBeLessThan(1e-3);
    expect(solved[0].distanceTo(solved[1])).toBeCloseTo(preferred[0].distanceTo(preferred[1]), 5);
    expect(solved[1].distanceTo(solved[2])).toBeCloseTo(preferred[1].distanceTo(preferred[2]), 5);
  });

  it("reports terrain normals and tilts the body toward the support surface", () => {
    const flatConfig = createDefaultProceduralHorseConfig();
    const slopeConfig = { ...flatConfig, terrainAmplitude: 0.6, terrainPreset: "slope" as const };
    const ground = sampleProceduralHorseTerrain(slopeConfig, 0.5, 0);
    const flat = resolveProceduralHorsePose(TEST_RIG, flatConfig, 0.2, 0.2);
    const slope = resolveProceduralHorsePose(TEST_RIG, slopeConfig, 0.2, 0.2);

    expect(ground.normal?.[0]).toBeLessThan(0);
    expect(slope.bodyRotation).not.toEqual(flat.bodyRotation);
  });
});

const TEST_RIG: ResolvedHorseRig = {
  bodyCenter: [0, 1.7, 0],
  chestPosition: [0, 2.2, 0.45],
  groundY: 0,
  headPosition: [0, 2.7, 1.5],
  rootBindPosition: [0, 0.5, 0],
  saddlePosition: [0, 2.15, -0.1],
  legs: {
    frontLeft: createFrontLeg("frontLeft", 0.45, 0.8),
    frontRight: createFrontLeg("frontRight", -0.45, 0.8),
    hindLeft: createHindLeg("hindLeft", 0.45, -0.8),
    hindRight: createHindLeg("hindRight", -0.45, -0.8),
  },
};

function createFrontLeg(hoofId: "frontLeft" | "frontRight", x: number, z: number) {
  const suffix = hoofId === "frontLeft" ? "Left" : "Right";
  return {
    boneNames: [`shoulder${suffix}`, `upper${suffix}`, `lower${suffix}`],
    bindPoints: [
      [x * 0.55, 1.95, z],
      [x, 1.9, z + 0.04],
      [x, 1.05, z + 0.14],
      [x, 0.22, z],
    ],
    hoofBoneName: `hoof${suffix}`,
    hoofId,
    hoofOffset: [0, -0.22, 0.08],
    segmentIds: [`frontShoulder${suffix}`, `frontUpper${suffix}`, `frontLower${suffix}`],
    targetBoneName: `target${suffix}`,
  } as const;
}

function createHindLeg(hoofId: "hindLeft" | "hindRight", x: number, z: number) {
  const suffix = hoofId === "hindLeft" ? "Left" : "Right";
  return {
    boneNames: [`shoulder${suffix}`, `upper${suffix}`, `middle${suffix}`, `lower${suffix}`],
    bindPoints: [
      [x * 0.45, 2, z],
      [x, 1.95, z],
      [x, 1.45, z + 0.4],
      [x, 0.8, z - 0.3],
      [x, 0.22, z],
    ],
    hoofBoneName: `hoof${suffix}`,
    hoofId,
    hoofOffset: [0, -0.22, 0.08],
    segmentIds: [`hindShoulder${suffix}`, `hindUpper${suffix}`, `hindMiddle${suffix}`, `hindLower${suffix}`],
    targetBoneName: `target${suffix}`,
  } as const;
}
