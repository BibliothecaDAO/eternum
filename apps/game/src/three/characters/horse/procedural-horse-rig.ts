import { type Group, Vector3 } from "three";

import {
  HORSE_LEG_SEGMENT_IDS,
  requireHorseBone,
  type HorseLegSegmentId,
  type HorseRigAdapter,
  type HorseVector3Tuple,
} from "./horse-rig-adapter";
import { HORSE_HOOF_IDS, type HorseHoofId } from "./procedural-horse-gait";

export { HORSE_LEG_SEGMENT_IDS, type HorseLegSegmentId, type HorseVector3Tuple } from "./horse-rig-adapter";

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
  chestPosition: HorseVector3Tuple;
  groundY: number;
  headPosition: HorseVector3Tuple;
  legs: Readonly<Record<HorseHoofId, ResolvedHorseLegRig>>;
  rootBindPosition: HorseVector3Tuple;
  saddlePosition: HorseVector3Tuple;
}

export function resolveHorseRig(adapter: HorseRigAdapter, coordinateSpace: Group, scene: Group): ResolvedHorseRig {
  scene.updateWorldMatrix(true, true);
  const legs = Object.fromEntries(
    HORSE_HOOF_IDS.map((hoofId) => [hoofId, resolveLegRig(adapter, coordinateSpace, scene, hoofId)]),
  ) as Record<HorseHoofId, ResolvedHorseLegRig>;
  const groundY = Math.min(...Object.values(legs).map(({ bindPoints }) => bindPoints.at(-1)?.[1] ?? 0));
  const pelvis = readBonePosition(adapter, coordinateSpace, scene, adapter.axialBones.pelvis);
  const chest = readBonePosition(adapter, coordinateSpace, scene, adapter.axialBones.chest);
  const withers = readBonePosition(adapter, coordinateSpace, scene, adapter.axialBones.withers);
  const bodyCenter = pelvis.clone().add(chest).multiplyScalar(0.5);
  const saddlePosition = pelvis
    .clone()
    .lerp(withers, adapter.saddle.pelvisToWithers)
    .add(new Vector3(...adapter.saddle.offset));

  return {
    bodyCenter: toTuple(bodyCenter),
    chestPosition: toTuple(chest),
    groundY,
    headPosition: toTuple(readBonePosition(adapter, coordinateSpace, scene, adapter.axialBones.head)),
    legs,
    rootBindPosition: toTuple(readBonePosition(adapter, coordinateSpace, scene, adapter.axialBones.root)),
    saddlePosition: toTuple(saddlePosition),
  };
}

function resolveLegRig(
  adapter: HorseRigAdapter,
  coordinateSpace: Group,
  scene: Group,
  hoofId: HorseHoofId,
): ResolvedHorseLegRig {
  const names = adapter.legs[hoofId];
  const target = readBonePosition(adapter, coordinateSpace, scene, names.target);
  const hoof = readBonePosition(adapter, coordinateSpace, scene, names.hoof);
  return {
    boneNames: names.bones,
    bindPoints: [
      ...names.bones.map((name) => toTuple(readBonePosition(adapter, coordinateSpace, scene, name))),
      toTuple(target),
    ],
    hoofBoneName: names.hoof,
    hoofId,
    hoofOffset: toTuple(hoof.sub(target)),
    segmentIds: names.segments,
    targetBoneName: names.target,
  };
}

function readBonePosition(adapter: HorseRigAdapter, coordinateSpace: Group, scene: Group, name: string): Vector3 {
  const worldPosition = requireHorseBone(scene, name, adapter).getWorldPosition(new Vector3());
  return coordinateSpace.worldToLocal(worldPosition);
}

function toTuple(vector: Vector3): HorseVector3Tuple {
  return [vector.x, vector.y, vector.z];
}
