import { Euler, Quaternion, Vector3 } from "three";

import type { ProceduralCharacterConfig } from "./procedural-character-config";
import type { ProceduralCharacterGaitSignals } from "./procedural-character-gait";
import type { ProceduralMeleeUpperBodyPose } from "./melee/procedural-melee-pose";
import type {
  CharacterPartPose,
  ProceduralCharacterPose,
  QuaternionTuple,
  Vector3Tuple,
} from "./procedural-character-pose";
import type { CharacterPartId, ResolvedCharacterRig } from "./procedural-character-rig";
import { resolveSeededMotionValue } from "./procedural-motion-curves";

export const KNIGHT_DEATH_DURATION_SECONDS = 1.15;

export interface KnightLiveCadence {
  chestLift: number;
  headPitchDegrees: number;
  headYawDegrees: number;
  leftElbowDelta: Vector3Tuple;
  leftWristDelta: Vector3Tuple;
  rightElbowDelta: Vector3Tuple;
  rightWristDelta: Vector3Tuple;
  spineTwistDegrees: number;
}

const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);

export function resolveKnightLiveCadence(
  config: ProceduralCharacterConfig,
  gait: ProceduralCharacterGaitSignals,
  elapsedSeconds: number,
  action: ProceduralMeleeUpperBodyPose,
): KnightLiveCadence | undefined {
  if (elapsedSeconds <= 0 || config.animationMode === "mounted") return undefined;
  const attackIntensity = Math.max(
    action.windupProgress,
    action.strikeProgress,
    action.contactProgress,
    action.followThrough,
  );
  const weight = clampUnit(1 - attackIntensity * 2.5);
  if (weight <= 1e-4) return undefined;
  const seedPhase = resolveSeededMotionValue(config.seed, 107) * Math.PI;
  if (config.animationMode === "idle") {
    return resolveKnightIdleCadence(elapsedSeconds, seedPhase, weight);
  }
  return resolveKnightMarchCadence(gait.phaseRadians, config.animationMode === "run" ? 1.32 : 1, weight);
}

function resolveKnightIdleCadence(elapsedSeconds: number, seedPhase: number, weight: number): KnightLiveCadence {
  const breath = Math.sin(elapsedSeconds * 2.15 + seedPhase);
  const sway = Math.sin(elapsedSeconds * 0.92 + seedPhase * 0.7);
  const scan = Math.sin(elapsedSeconds * 0.68 + seedPhase * 1.3);
  return {
    chestLift: breath * 0.0045 * weight,
    headPitchDegrees: breath * 1.8 * weight,
    headYawDegrees: scan * 6.5 * weight,
    leftElbowDelta: [0.003 * weight, 0.003 * breath * weight, 0.002 * sway * weight],
    leftWristDelta: [0.004 * weight, 0.005 * breath * weight, 0.004 * sway * weight],
    rightElbowDelta: [-0.003 * weight, 0.003 * breath * weight, -0.002 * sway * weight],
    rightWristDelta: [-0.005 * weight, 0.006 * breath * weight, -0.004 * sway * weight],
    spineTwistDegrees: sway * 2.4 * weight,
  };
}

function resolveKnightMarchCadence(phaseRadians: number, boost: number, weight: number): KnightLiveCadence {
  const stride = Math.sin(phaseRadians);
  const doubleStride = Math.cos(phaseRadians * 2);
  const scale = boost * weight;
  return {
    chestLift: doubleStride * 0.005 * scale,
    headPitchDegrees: doubleStride * 2.6 * scale,
    headYawDegrees: -stride * 3.5 * scale,
    leftElbowDelta: [0.006 * weight, 0.005 * doubleStride * scale, -0.009 * stride * scale],
    leftWristDelta: [0.008 * weight, (0.006 + 0.008 * doubleStride) * scale, -0.014 * stride * scale],
    rightElbowDelta: [-0.008 * weight, 0.006 * doubleStride * scale, 0.014 * stride * scale],
    rightWristDelta: [-0.012 * weight, (0.005 + 0.011 * doubleStride) * scale, 0.022 * stride * scale],
    spineTwistDegrees: -stride * 5.2 * scale,
  };
}

export function resolveKnightDeathPose(
  rig: ResolvedCharacterRig,
  config: ProceduralCharacterConfig,
  deathProgress: number,
): ProceduralCharacterPose {
  const progress = clampUnit(deathProgress);
  const recoil = smoothPhase(progress, 0, 0.25);
  const collapse = smoothPhase(progress, 0.22, 0.74);
  const settleT = clampUnit((progress - 0.74) / 0.26);
  const bounce = settleT > 0 ? Math.sin(settleT * Math.PI * 1.5) * Math.exp(-3.4 * settleT) : 0;

  const morphology = rig.morphology;
  const scale = morphology.scale;
  const ankleHeight = morphology.foot.ankleHeight;
  const restPelvisY =
    morphology.restPelvisHeight ?? ankleHeight + morphology.thighLength + morphology.shinLength - scale * 0.055;
  const groundPelvisY = Math.max(ankleHeight + 0.032, restPelvisY * 0.22);
  const pelvisY =
    lerp(restPelvisY, restPelvisY * 0.84, recoil) * (1 - collapse) +
    (groundPelvisY + Math.max(0, bounce) * 0.022) * collapse;
  const pelvis = new Vector3(
    collapse * 0.05 * scale,
    pelvisY,
    -0.055 * scale - recoil * 0.055 * scale + collapse * 0.16 * scale,
  );
  const pelvisRotation = new Quaternion().setFromEuler(
    new Euler(
      -recoil * 0.2 + collapse * 1.26 - bounce * 0.08,
      recoil * 0.14 - collapse * 0.24,
      collapse * 0.34 + bounce * 0.05,
      "YXZ",
    ),
  );

  const pelvisHalfHeight = rig.parts.pelvis.halfExtents?.[1] ?? 0.16;
  const chestHalfHeight = rig.parts.chest.halfExtents?.[1] ?? morphology.torsoLength * 0.46;
  const spineAnchor = pelvis.clone().add(new Vector3(0, pelvisHalfHeight, 0).applyQuaternion(pelvisRotation));
  const chestDelta = new Quaternion().setFromEuler(
    new Euler(-recoil * 0.16 + collapse * 0.14 - bounce * 0.05, -collapse * 0.1, collapse * 0.08, "YXZ"),
  );
  const chestRotation = pelvisRotation.clone().multiply(chestDelta).normalize();
  const chest = spineAnchor.clone().add(new Vector3(0, chestHalfHeight * 0.9, 0).applyQuaternion(pelvisRotation));
  chest.y = Math.max(chest.y, ankleHeight + 0.045);

  const neckAnchor = chest.clone().add(new Vector3(0, chestHalfHeight, 0).applyQuaternion(chestRotation));
  const headDelta = new Quaternion().setFromEuler(
    new Euler(-recoil * 0.2 - collapse * 0.18 + bounce * 0.06, collapse * 0.22, -collapse * 0.12, "YXZ"),
  );
  const headRotation = chestRotation.clone().multiply(headDelta).normalize();
  const head = neckAnchor.clone().add(new Vector3(0, morphology.headRadius * 0.95, 0).applyQuaternion(chestRotation));
  head.y = Math.max(head.y, ankleHeight + 0.055);

  const shoulderOffset = morphology.shoulderWidth * 0.48;
  const shoulderHeight = chestHalfHeight * 0.58;
  const leftShoulder = chest.clone().add(new Vector3(shoulderOffset, shoulderHeight, 0).applyQuaternion(chestRotation));
  const rightShoulder = chest
    .clone()
    .add(new Vector3(-shoulderOffset, shoulderHeight, 0).applyQuaternion(chestRotation));

  const leftArmTarget = resolveDeathArmTarget(leftShoulder, chestRotation, scale, ankleHeight, [
    0.16 + recoil * 0.05 + collapse * 0.16,
    -0.14 + recoil * 0.06 + collapse * 0.1,
    0.14 - collapse * 0.1,
  ]);
  const leftArmPole = leftShoulder
    .clone()
    .add(new Vector3(0.28 * scale, 0.04 * scale, -0.1 * scale).applyQuaternion(chestRotation));
  const rightArmTarget = resolveDeathArmTarget(rightShoulder, chestRotation, scale, ankleHeight, [
    -0.18 - recoil * 0.06 - collapse * 0.18,
    -0.16 + recoil * 0.08 + collapse * 0.14,
    0.1 - collapse * 0.08,
  ]);
  const rightArmPole = rightShoulder
    .clone()
    .add(new Vector3(-0.28 * scale, 0.04 * scale, -0.1 * scale).applyQuaternion(chestRotation));

  const leftArm = solveTwoBoneLimb(
    leftShoulder,
    leftArmTarget,
    leftArmPole,
    morphology.upperArmLength,
    morphology.forearmLength,
  );
  const rightArm = solveTwoBoneLimb(
    rightShoulder,
    rightArmTarget,
    rightArmPole,
    morphology.upperArmLength,
    morphology.forearmLength,
  );

  const leftHip = pelvis
    .clone()
    .add(new Vector3(morphology.hipWidth * 0.5, -0.08 * scale, 0).applyQuaternion(pelvisRotation));
  const rightHip = pelvis
    .clone()
    .add(new Vector3(-morphology.hipWidth * 0.5, -0.08 * scale, 0).applyQuaternion(pelvisRotation));
  const leftAnkle = new Vector3(
    0.06 * scale + collapse * 0.05 * scale,
    ankleHeight,
    -0.02 * scale - collapse * 0.28 * scale,
  );
  const rightAnkle = new Vector3(
    -0.065 * scale - collapse * 0.05 * scale,
    ankleHeight,
    -0.04 * scale - collapse * 0.34 * scale,
  );
  const kneeForward = new Vector3(0, -0.25, 0.96).normalize();
  const leftKneePole = leftHip
    .clone()
    .addScaledVector(kneeForward, 0.4 * scale)
    .add(new Vector3(0.06 * scale, 0, 0));
  const rightKneePole = rightHip
    .clone()
    .addScaledVector(kneeForward, 0.4 * scale)
    .add(new Vector3(-0.08 * scale, 0, 0));
  const leftLeg = solveTwoBoneLimb(leftHip, leftAnkle, leftKneePole, morphology.thighLength, morphology.shinLength);
  const rightLeg = solveTwoBoneLimb(rightHip, rightAnkle, rightKneePole, morphology.thighLength, morphology.shinLength);

  const parts = {} as Record<CharacterPartId, CharacterPartPose>;
  parts.pelvis = createPartPose(pelvis, pelvisRotation, pelvis);
  parts.chest = createPartPose(chest, chestRotation, spineAnchor);
  parts.head = createPartPose(head, headRotation, neckAnchor);
  parts.upperArmLeft = createSegmentPose(leftArm.root, leftArm.mid);
  parts.forearmLeft = createSegmentPose(leftArm.mid, leftArm.end);
  parts.upperArmRight = createSegmentPose(rightArm.root, rightArm.mid);
  parts.forearmRight = createSegmentPose(rightArm.mid, rightArm.end);
  parts.thighLeft = createSegmentPose(leftLeg.root, leftLeg.mid);
  parts.shinLeft = createSegmentPose(leftLeg.mid, leftLeg.end);
  parts.thighRight = createSegmentPose(rightLeg.root, rightLeg.mid);
  parts.shinRight = createSegmentPose(rightLeg.mid, rightLeg.end);

  const restCycle = { contact: "stance" as const, progress: 0.5 };
  const toeOut = (config.footProgressionDegrees * Math.PI) / 180;
  return {
    feet: {
      left: { cycle: restCycle, target: toVectorTuple(leftLeg.end), yawRadians: toeOut + collapse * 0.32 },
      right: { cycle: restCycle, target: toVectorTuple(rightLeg.end), yawRadians: -toeOut - collapse * 0.38 },
    },
    phase: progress,
    parts,
    joints: [
      toVectorTuple(spineAnchor),
      toVectorTuple(neckAnchor),
      toVectorTuple(leftArm.root),
      toVectorTuple(leftArm.mid),
      toVectorTuple(rightArm.root),
      toVectorTuple(rightArm.mid),
      toVectorTuple(leftLeg.root),
      toVectorTuple(leftLeg.mid),
      toVectorTuple(rightLeg.root),
      toVectorTuple(rightLeg.mid),
    ],
  };
}

function resolveDeathArmTarget(
  shoulder: Vector3,
  chestRotation: Quaternion,
  scale: number,
  ankleHeight: number,
  offset: readonly [number, number, number],
): Vector3 {
  const target = shoulder
    .clone()
    .add(new Vector3(offset[0] * scale, offset[1] * scale, offset[2] * scale).applyQuaternion(chestRotation));
  target.y = Math.max(target.y, ankleHeight + 0.055);
  return target;
}

function solveTwoBoneLimb(
  root: Vector3,
  target: Vector3,
  pole: Vector3,
  firstLength: number,
  secondLength: number,
): { end: Vector3; mid: Vector3; root: Vector3 } {
  const offset = target.clone().sub(root);
  const rawDistance = Math.max(offset.length(), 1e-6);
  const distance = clamp(
    rawDistance,
    Math.abs(firstLength - secondLength) + 1e-4,
    (firstLength + secondLength) * 0.985,
  );
  const direction = offset.multiplyScalar(1 / rawDistance);
  const end = root.clone().addScaledVector(direction, distance);
  const along = (firstLength * firstLength - secondLength * secondLength + distance * distance) / (2 * distance);
  const bendDistance = Math.sqrt(Math.max(0, firstLength * firstLength - along * along));
  const poleDirection = pole.clone().sub(root).addScaledVector(direction, -pole.clone().sub(root).dot(direction));
  if (poleDirection.lengthSq() < 1e-8) poleDirection.copy(Z_AXIS);
  poleDirection.normalize();
  const mid = root.clone().addScaledVector(direction, along).addScaledVector(poleDirection, bendDistance);
  return { end, mid, root };
}

function createSegmentPose(from: Vector3, to: Vector3): CharacterPartPose {
  const direction = to.clone().sub(from);
  const quaternion =
    direction.lengthSq() < 1e-10
      ? new Quaternion()
      : new Quaternion().setFromUnitVectors(Y_AXIS, direction.clone().normalize());
  return {
    position: toVectorTuple(from.clone().add(to).multiplyScalar(0.5)),
    quaternion: toQuaternionTuple(quaternion),
    jointAnchor: toVectorTuple(from),
  };
}

function createPartPose(position: Vector3, quaternion: Quaternion, jointAnchor: Vector3): CharacterPartPose {
  return {
    position: toVectorTuple(position),
    quaternion: toQuaternionTuple(quaternion),
    jointAnchor: toVectorTuple(jointAnchor),
  };
}

function smoothPhase(value: number, start: number, end: number): number {
  const t = clampUnit((value - start) / Math.max(1e-6, end - start));
  return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, weight: number): number {
  return from + (to - from) * weight;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toVectorTuple(vector: Vector3): Vector3Tuple {
  return [vector.x, vector.y, vector.z];
}

function toQuaternionTuple(quaternion: Quaternion): QuaternionTuple {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}
