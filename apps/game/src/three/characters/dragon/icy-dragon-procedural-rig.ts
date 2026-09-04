import { Bone, Euler, Quaternion, Vector3, type Group } from "three";

import type { ProceduralDragonPose } from "./procedural-dragon-pose";
import {
  ICY_DRAGON_LEG_IDS,
  ICY_DRAGON_RIG_ADAPTER,
  resolveIcyDragonRequiredBoneNames,
  type IcyDragonRigAdapter,
} from "./icy-dragon-rig-adapter";

interface LocalBoneTransform {
  bone: Bone;
  modelToBone: Quaternion;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}

interface IcyBoneBinding {
  transform: LocalBoneTransform;
}

export interface IcyProceduralDragonRig {
  adapter: IcyDragonRigAdapter;
  bindings: ReadonlyMap<string, IcyBoneBinding>;
  mouth: Bone;
  saddle: Bone;
}

const candidateFootWorld = new Vector3();
const convertedOffset = new Quaternion();
const inverseBasis = new Quaternion();
const modelEuler = new Euler(0, 0, 0, "YXZ");
const modelRotation = new Quaternion();
const secondaryModelRotation = new Quaternion();
const sceneWorldQuaternion = new Quaternion();
const boneWorldQuaternion = new Quaternion();
const MODEL_FORWARD = new Vector3(0, 0, 1);
const MODEL_UP = new Vector3(0, 1, 0);

export function createIcyProceduralDragonRig(
  scene: Group,
  adapter: IcyDragonRigAdapter = ICY_DRAGON_RIG_ADAPTER,
): IcyProceduralDragonRig {
  const bindings = new Map<string, IcyBoneBinding>();
  scene.updateWorldMatrix(true, true);
  resolveIcyDragonRequiredBoneNames(adapter).forEach((name) => {
    const bone = scene.getObjectByName(name);
    if (!(bone instanceof Bone)) throw new Error(`Icy procedural rig bone ${name} was not found`);
    bindings.set(name, { transform: captureLocalTransform(scene, bone) });
  });
  return {
    adapter,
    bindings,
    mouth: requireRepresentativeBone(bindings, adapter.mouth),
    saddle: requireRepresentativeBone(bindings, adapter.saddle),
  };
}

export function applyIcyProceduralRigPose(rig: IcyProceduralDragonRig, pose: ProceduralDragonPose): void {
  resetIcyProceduralRig(rig);
  applyNeckPose(rig, pose);
  applyWingPose(rig, pose);
  applyLegPose(rig, pose);
  applyTailPose(rig, pose);
  applyModelEulerOffset(rig, rig.adapter.jaw, pose.jawOpen * 0.38, 0, 0);
}

export function isIcyProceduralRigFinite(rig: IcyProceduralDragonRig): boolean {
  return [...rig.bindings.values()].every(({ transform: { bone } }) =>
    [...bone.position.toArray(), ...bone.quaternion.toArray(), ...bone.scale.toArray()].every(Number.isFinite),
  );
}

export function writeIcyLowestFootWorldPosition(
  rig: IcyProceduralDragonRig,
  pose: ProceduralDragonPose,
  out: Vector3,
): Vector3 {
  const stanceLegIds = ICY_DRAGON_LEG_IDS.filter((legId) => pose.legs[legId].contact);
  const measuredLegIds = stanceLegIds.length > 0 ? stanceLegIds : ICY_DRAGON_LEG_IDS;
  let hasFoot = false;
  measuredLegIds.forEach((legId) => {
    const footName = rig.adapter.legs[legId].foot;
    const foot = rig.bindings.get(footName)?.transform.bone;
    if (!foot) throw new Error(`Icy procedural rig foot ${footName} was not found`);
    foot.getWorldPosition(candidateFootWorld);
    if (!hasFoot || candidateFootWorld.y < out.y) out.copy(candidateFootWorld);
    hasFoot = true;
  });
  if (!hasFoot) throw new Error("Icy procedural rig has no measurable feet");
  return out;
}

function resetIcyProceduralRig(rig: IcyProceduralDragonRig): void {
  rig.bindings.forEach(({ transform: { bone, position, quaternion, scale } }) => {
    bone.position.copy(position);
    bone.quaternion.copy(quaternion);
    bone.scale.copy(scale);
  });
}

function applyNeckPose(rig: IcyProceduralDragonRig, pose: ProceduralDragonPose): void {
  rig.adapter.neck.forEach((name, index) => {
    const poseIndex = Math.min(
      pose.neckRotations.length - 1,
      Math.floor((index * pose.neckRotations.length) / rig.adapter.neck.length),
    );
    applyModelQuaternionOffset(rig, name, pose.neckRotations[poseIndex]);
  });
}

function applyWingPose(rig: IcyProceduralDragonRig, pose: ProceduralDragonPose): void {
  Object.entries(rig.adapter.wings).forEach(([side, wing]) => {
    const sideDirection = side === "left" ? -1 : 1;
    // The source mirrors one wing through its transform hierarchy, so equal local flap signs produce a mirrored world pose.
    modelRotation
      .setFromAxisAngle(MODEL_UP, (1 - pose.wings.spread) * sideDirection * 1.02)
      .multiply(secondaryModelRotation.setFromAxisAngle(MODEL_FORWARD, pose.wings.flap * 0.62));
    applyModelRotationOffset(rig, wing.root, modelRotation);
    applyModelAxisAngleOffset(rig, wing.outer, MODEL_FORWARD, pose.wings.flap * 0.18);
    wing.tips.forEach((name) => {
      applyModelAxisAngleOffset(rig, name, MODEL_FORWARD, pose.wings.flap * 0.08);
    });
  });
}

function applyLegPose(rig: IcyProceduralDragonRig, pose: ProceduralDragonPose): void {
  ICY_DRAGON_LEG_IDS.forEach((legId) => {
    const definition = rig.adapter.legs[legId];
    const leg = pose.legs[legId];
    applyModelEulerOffset(rig, definition.hip, leg.hipPitch - 0.02, 0, 0);
    applyModelEulerOffset(rig, definition.knee, leg.kneePitch - 0.38, 0, 0);
    applyModelEulerOffset(rig, definition.ankle, leg.anklePitch + 0.08, 0, 0);
    applyModelEulerOffset(rig, definition.foot, (leg.anklePitch + 0.08) * 0.35, 0, 0);
  });
}

function applyTailPose(rig: IcyProceduralDragonRig, pose: ProceduralDragonPose): void {
  rig.adapter.tail.forEach((name, index) => {
    const poseIndex = Math.min(
      pose.tailRotations.length - 1,
      Math.floor((index * pose.tailRotations.length) / rig.adapter.tail.length),
    );
    applyModelQuaternionOffset(rig, name, pose.tailRotations[poseIndex]);
  });
}

function applyModelEulerOffset(rig: IcyProceduralDragonRig, name: string, x: number, y: number, z: number): void {
  modelRotation.setFromEuler(modelEuler.set(x, y, z));
  applyModelRotationOffset(rig, name, modelRotation);
}

function applyModelAxisAngleOffset(
  rig: IcyProceduralDragonRig,
  name: string,
  axis: Readonly<Vector3>,
  angle: number,
): void {
  modelRotation.setFromAxisAngle(axis, angle);
  applyModelRotationOffset(rig, name, modelRotation);
}

function applyModelQuaternionOffset(
  rig: IcyProceduralDragonRig,
  name: string,
  tuple: readonly [number, number, number, number],
): void {
  modelRotation.fromArray(tuple);
  applyModelRotationOffset(rig, name, modelRotation);
}

function applyModelRotationOffset(rig: IcyProceduralDragonRig, name: string, rotation: Quaternion): void {
  const binding = rig.bindings.get(name);
  if (!binding) throw new Error(`Icy procedural rig binding ${name} was not found`);
  const { modelToBone, bone, quaternion } = binding.transform;
  inverseBasis.copy(modelToBone).invert();
  convertedOffset.copy(modelToBone).multiply(rotation).multiply(inverseBasis);
  bone.quaternion.copy(quaternion).multiply(convertedOffset).normalize();
}

function captureLocalTransform(scene: Group, bone: Bone): LocalBoneTransform {
  scene.getWorldQuaternion(sceneWorldQuaternion);
  bone.getWorldQuaternion(boneWorldQuaternion);
  return {
    bone,
    modelToBone: boneWorldQuaternion.clone().invert().multiply(sceneWorldQuaternion),
    position: bone.position.clone(),
    quaternion: bone.quaternion.clone(),
    scale: bone.scale.clone(),
  };
}

function requireRepresentativeBone(bindings: ReadonlyMap<string, IcyBoneBinding>, name: string): Bone {
  const bone = bindings.get(name)?.transform.bone;
  if (!bone) throw new Error(`Icy procedural rig representative bone ${name} was not found`);
  return bone;
}
