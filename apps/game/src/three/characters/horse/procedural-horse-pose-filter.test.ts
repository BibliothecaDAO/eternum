import { Quaternion } from "three";
import { describe, expect, it } from "vitest";

import { createDefaultProceduralHorseConfig } from "./procedural-horse-config";
import { resolveProceduralHorsePose } from "./procedural-horse-pose";
import { ProceduralHorsePoseFilter } from "./procedural-horse-pose-filter";
import type { ResolvedHorseRig } from "./procedural-horse-rig";

describe("procedural horse pose filter", () => {
  it("lags neck and tail rotations without changing hoof targets", () => {
    const config = createDefaultProceduralHorseConfig();
    const source = resolveProceduralHorsePose(TEST_RIG, config, 0, 0);
    const target = resolveProceduralHorsePose(TEST_RIG, config, 0.35, 0.35);
    const filter = new ProceduralHorsePoseFilter();
    filter.apply(source, 0, config.secondaryMotion);
    const filtered = filter.apply(target, 1 / 60, config.secondaryMotion);

    expect(filtered.legs).toBe(target.legs);
    expect(quaternionAngle(filtered.neckRotations[0], target.neckRotations[0])).toBeGreaterThan(0);
  });
});

function quaternionAngle(left: readonly number[], right: readonly number[]): number {
  return new Quaternion(...(left as [number, number, number, number])).angleTo(
    new Quaternion(...(right as [number, number, number, number])),
  );
}

const TEST_RIG: ResolvedHorseRig = {
  bodyCenter: [0, 1.7, 0],
  chestPosition: [0, 2.2, 0.45],
  groundY: 0,
  headPosition: [0, 2.7, 1.5],
  rootBindPosition: [0, 0.5, 0],
  saddlePosition: [0, 2.15, -0.1],
  legs: {
    frontLeft: createLeg("frontLeft", 0.45, 0.8),
    frontRight: createLeg("frontRight", -0.45, 0.8),
    hindLeft: createLeg("hindLeft", 0.45, -0.8),
    hindRight: createLeg("hindRight", -0.45, -0.8),
  },
};

function createLeg(hoofId: keyof ResolvedHorseRig["legs"], x: number, z: number) {
  const suffix = hoofId.endsWith("Left") ? "Left" : "Right";
  const prefix = hoofId.startsWith("front") ? "front" : "hind";
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
    segmentIds: [`${prefix}Shoulder${suffix}`, `${prefix}Upper${suffix}`, `${prefix}Lower${suffix}`],
    targetBoneName: `target${suffix}`,
  } as ResolvedHorseRig["legs"][typeof hoofId];
}
