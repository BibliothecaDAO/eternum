import { Group } from "three";
import { describe, expect, it } from "vitest";

import { createDefaultProceduralHorseConfig } from "./procedural-horse-config";
import { resolveProceduralHorsePose } from "./procedural-horse-pose";
import type { ResolvedHorseRig } from "./procedural-horse-rig";
import { createHorseRagdollProfile, HORSE_RAGDOLL_PART_IDS } from "./jolt-horse-ragdoll";

describe("horse ragdoll profile", () => {
  it("maps every body and visible leg segment into one acyclic articulated profile", () => {
    const pose = resolveProceduralHorsePose(TEST_RIG, createDefaultProceduralHorseConfig(), 0.2, 0.2);
    const profile = createHorseRagdollProfile(TEST_RIG, pose, new Group());

    expect(profile.definition.partIds).toEqual(HORSE_RAGDOLL_PART_IDS);
    expect(profile.definition.partIds).toHaveLength(17);
    expect(Object.keys(profile.segmentLengths)).toHaveLength(14);
    for (const partId of profile.definition.partIds) {
      const part = profile.definition.parts[partId];
      expect(profile.definition.pose[partId]).toBeDefined();
      if (part.parentId) expect(profile.definition.parts[part.parentId]).toBeDefined();
    }
  });

  it("keeps visual segment lengths local while scaling physics shapes into world space", () => {
    const pose = resolveProceduralHorsePose(TEST_RIG, createDefaultProceduralHorseConfig(), 0.2, 0.2);
    const coordinateSpace = new Group();
    coordinateSpace.scale.setScalar(0.5);
    coordinateSpace.updateWorldMatrix(true, false);
    const profile = createHorseRagdollProfile(TEST_RIG, pose, coordinateSpace);
    const segmentId = TEST_RIG.legs.frontLeft.segmentIds[0];

    expect(profile.definition.parts.horseBody.halfExtents).toEqual([0.21, 0.19, 0.36]);
    expect(profile.definition.parts[segmentId].length).toBeCloseTo(profile.segmentLengths[segmentId] * 0.5);
    expect(profile.definition.parts[segmentId].radius).toBeCloseTo(0.105 * 0.5);
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
    frontLeft: createLeg("frontLeft", ["frontShoulderLeft", "frontUpperLeft", "frontLowerLeft"], 0.45, 0.8),
    frontRight: createLeg("frontRight", ["frontShoulderRight", "frontUpperRight", "frontLowerRight"], -0.45, 0.8),
    hindLeft: createLeg(
      "hindLeft",
      ["hindShoulderLeft", "hindUpperLeft", "hindMiddleLeft", "hindLowerLeft"],
      0.45,
      -0.8,
    ),
    hindRight: createLeg(
      "hindRight",
      ["hindShoulderRight", "hindUpperRight", "hindMiddleRight", "hindLowerRight"],
      -0.45,
      -0.8,
    ),
  },
};

function createLeg(
  hoofId: keyof ResolvedHorseRig["legs"],
  segmentIds: ResolvedHorseRig["legs"][keyof ResolvedHorseRig["legs"]]["segmentIds"],
  x: number,
  z: number,
) {
  const pointCount = segmentIds.length + 1;
  return {
    boneNames: segmentIds,
    bindPoints: Array.from(
      { length: pointCount },
      (_, index) => [x, 2 - (index / (pointCount - 1)) * 1.78, z + (index % 2 === 0 ? -0.08 : 0.12)] as const,
    ),
    hoofBoneName: `${hoofId}Hoof`,
    hoofId,
    hoofOffset: [0, -0.22, 0.08] as const,
    segmentIds,
    targetBoneName: `${hoofId}Target`,
  };
}
