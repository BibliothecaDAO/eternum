import { type Group, Vector3 } from "three";

import { QUATERNIUS_HORSE_BONES, requireQuaterniusHorseBone } from "./quaternius-horse-assets";
import { HORSE_HOOF_IDS, type HorseHoofId } from "./procedural-horse-gait";

export const HORSE_LEG_SEGMENT_IDS = [
  "frontShoulderLeft",
  "frontUpperLeft",
  "frontLowerLeft",
  "frontShoulderRight",
  "frontUpperRight",
  "frontLowerRight",
  "hindShoulderLeft",
  "hindUpperLeft",
  "hindMiddleLeft",
  "hindLowerLeft",
  "hindShoulderRight",
  "hindUpperRight",
  "hindMiddleRight",
  "hindLowerRight",
] as const;

export type HorseLegSegmentId = (typeof HORSE_LEG_SEGMENT_IDS)[number];
export type HorseVector3Tuple = readonly [number, number, number];

export interface ResolvedHorseLegRig {
  boneNames: readonly string[];
  bindPoints: readonly HorseVector3Tuple[];
  hoofBoneName: string;
  hoofId: HorseHoofId;
  hoofOffset: HorseVector3Tuple;
  segmentIds: readonly HorseLegSegmentId[];
  targetBoneName: string;
}

export interface ResolvedHorseRig {
  bodyCenter: HorseVector3Tuple;
  groundY: number;
  headPosition: HorseVector3Tuple;
  legs: Readonly<Record<HorseHoofId, ResolvedHorseLegRig>>;
  rootBindPosition: HorseVector3Tuple;
  saddlePosition: HorseVector3Tuple;
}

interface LegBoneNames {
  bones: readonly string[];
  hoof: string;
  segments: readonly HorseLegSegmentId[];
  target: string;
}

const LEG_BONES: Readonly<Record<HorseHoofId, LegBoneNames>> = {
  frontLeft: {
    bones: [
      QUATERNIUS_HORSE_BONES.frontShoulderLeft,
      QUATERNIUS_HORSE_BONES.frontUpperLeft,
      QUATERNIUS_HORSE_BONES.frontLowerLeft,
    ],
    hoof: QUATERNIUS_HORSE_BONES.frontHoofLeft,
    segments: ["frontShoulderLeft", "frontUpperLeft", "frontLowerLeft"],
    target: QUATERNIUS_HORSE_BONES.frontTargetLeft,
  },
  frontRight: {
    bones: [
      QUATERNIUS_HORSE_BONES.frontShoulderRight,
      QUATERNIUS_HORSE_BONES.frontUpperRight,
      QUATERNIUS_HORSE_BONES.frontLowerRight,
    ],
    hoof: QUATERNIUS_HORSE_BONES.frontHoofRight,
    segments: ["frontShoulderRight", "frontUpperRight", "frontLowerRight"],
    target: QUATERNIUS_HORSE_BONES.frontTargetRight,
  },
  hindLeft: {
    bones: [
      QUATERNIUS_HORSE_BONES.hindShoulderLeft,
      QUATERNIUS_HORSE_BONES.hindUpperLeft,
      QUATERNIUS_HORSE_BONES.hindMiddleLeft,
      QUATERNIUS_HORSE_BONES.hindLowerLeft,
    ],
    hoof: QUATERNIUS_HORSE_BONES.hindHoofLeft,
    segments: ["hindShoulderLeft", "hindUpperLeft", "hindMiddleLeft", "hindLowerLeft"],
    target: QUATERNIUS_HORSE_BONES.hindTargetLeft,
  },
  hindRight: {
    bones: [
      QUATERNIUS_HORSE_BONES.hindShoulderRight,
      QUATERNIUS_HORSE_BONES.hindUpperRight,
      QUATERNIUS_HORSE_BONES.hindMiddleRight,
      QUATERNIUS_HORSE_BONES.hindLowerRight,
    ],
    hoof: QUATERNIUS_HORSE_BONES.hindHoofRight,
    segments: ["hindShoulderRight", "hindUpperRight", "hindMiddleRight", "hindLowerRight"],
    target: QUATERNIUS_HORSE_BONES.hindTargetRight,
  },
};

export function resolveQuaterniusHorseRig(coordinateSpace: Group, scene: Group): ResolvedHorseRig {
  scene.updateWorldMatrix(true, true);
  const legs = Object.fromEntries(
    HORSE_HOOF_IDS.map((hoofId) => [hoofId, resolveLegRig(coordinateSpace, scene, hoofId)]),
  ) as Record<HorseHoofId, ResolvedHorseLegRig>;
  const groundY = Math.min(...Object.values(legs).map(({ bindPoints }) => bindPoints.at(-1)?.[1] ?? 0));
  const pelvis = readBonePosition(coordinateSpace, scene, QUATERNIUS_HORSE_BONES.pelvis);
  const chest = readBonePosition(coordinateSpace, scene, QUATERNIUS_HORSE_BONES.chest);
  const withers = readBonePosition(coordinateSpace, scene, QUATERNIUS_HORSE_BONES.withers);
  const bodyCenter = pelvis.clone().add(chest).multiplyScalar(0.5);
  const saddlePosition = pelvis
    .clone()
    .lerp(withers, 0.42)
    .add(new Vector3(0, 0.34, -0.12));

  return {
    bodyCenter: toTuple(bodyCenter),
    groundY,
    headPosition: toTuple(readBonePosition(coordinateSpace, scene, QUATERNIUS_HORSE_BONES.head)),
    legs,
    rootBindPosition: toTuple(readBonePosition(coordinateSpace, scene, QUATERNIUS_HORSE_BONES.root)),
    saddlePosition: toTuple(saddlePosition),
  };
}

function resolveLegRig(coordinateSpace: Group, scene: Group, hoofId: HorseHoofId): ResolvedHorseLegRig {
  const names = LEG_BONES[hoofId];
  const target = readBonePosition(coordinateSpace, scene, names.target);
  const hoof = readBonePosition(coordinateSpace, scene, names.hoof);
  return {
    boneNames: names.bones,
    bindPoints: [
      ...names.bones.map((name) => toTuple(readBonePosition(coordinateSpace, scene, name))),
      toTuple(target),
    ],
    hoofBoneName: names.hoof,
    hoofId,
    hoofOffset: toTuple(hoof.sub(target)),
    segmentIds: names.segments,
    targetBoneName: names.target,
  };
}

function readBonePosition(coordinateSpace: Group, scene: Group, name: string): Vector3 {
  const worldPosition = requireQuaterniusHorseBone(scene, name).getWorldPosition(new Vector3());
  return coordinateSpace.worldToLocal(worldPosition);
}

function toTuple(vector: Vector3): HorseVector3Tuple {
  return [vector.x, vector.y, vector.z];
}
