import { Euler, Quaternion, Vector3 } from "three";

import type { ProceduralArcherUpperBodyPose } from "./archer/procedural-archer-pose";
import type { ProceduralCrossbowUpperBodyPose } from "./crossbow/procedural-crossbow-pose";
import type { ProceduralMeleeUpperBodyPose } from "./melee/procedural-melee-pose";
import type { ProceduralCharacterUpperBodyAction } from "./procedural-character-action";
import type { ProceduralCharacterConfig } from "./procedural-character-config";
import {
  resolveProceduralCharacterGaitSignals,
  type CharacterFootId,
  type ProceduralCharacterGaitSignals,
} from "./procedural-character-gait";
import {
  resolveOrganicLimbTrajectory,
  resolveSeededMotionValue,
  type ProceduralContactCycle,
} from "./procedural-motion-curves";
import type { ProceduralPlantTargetResolver } from "./procedural-plant-controller";
import { CHARACTER_PART_IDS, type CharacterPartId, type ResolvedCharacterRig } from "./procedural-character-rig";

export type Vector3Tuple = readonly [number, number, number];
export type QuaternionTuple = readonly [number, number, number, number];

export interface CharacterPartPose {
  position: Vector3Tuple;
  quaternion: QuaternionTuple;
  jointAnchor: Vector3Tuple;
}

export interface CharacterFootPose {
  cycle: ProceduralContactCycle;
  target: Vector3Tuple;
}

export interface ProceduralCharacterPose {
  feet: Readonly<Record<CharacterFootId, CharacterFootPose>>;
  phase: number;
  parts: Readonly<Record<CharacterPartId, CharacterPartPose>>;
  joints: readonly Vector3Tuple[];
}

interface CharacterLegJoints {
  ankle: Vector3;
  cycle: ProceduralContactCycle;
  hip: Vector3;
  knee: Vector3;
}

interface CharacterArmJoints {
  elbow: Vector3;
  shoulder: Vector3;
  wrist: Vector3;
}

interface CharacterTorsoJoints {
  chest: Vector3;
  chestRotation: Quaternion;
  head: Vector3;
  headRotation: Quaternion;
  leftShoulder: Vector3;
  neckAnchor: Vector3;
  rightShoulder: Vector3;
  spineAnchor: Vector3;
}

const Y_AXIS = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);
const CHARACTER_GROUND_Y = 0.12;

export function resolveProceduralCharacterPose(
  rig: ResolvedCharacterRig,
  config: ProceduralCharacterConfig,
  elapsedSeconds: number,
  resolvePlantTarget?: ProceduralPlantTargetResolver<CharacterFootId>,
  phaseOverride?: number,
  upperBodyAction?: ProceduralCharacterUpperBodyAction,
): ProceduralCharacterPose {
  if (config.animationMode === "mounted")
    return resolveMountedCharacterPose(rig, config, elapsedSeconds, phaseOverride, upperBodyAction);

  const gait = resolveProceduralCharacterGaitSignals(config, elapsedSeconds, phaseOverride);
  const basePelvis = resolveGroundedPelvis(rig, config, gait, elapsedSeconds);
  const basePelvisRotation = resolvePelvisRotation(config, gait);
  const { pelvis, pelvisRotation } = resolveActionPelvis(rig, basePelvis, basePelvisRotation, upperBodyAction);
  const leftLeg = resolveGroundedLeg(rig, config, gait, pelvis, "left", resolvePlantTarget, basePelvis);
  const rightLeg = resolveGroundedLeg(rig, config, gait, pelvis, "right", resolvePlantTarget, basePelvis);
  const baseTorso = resolveGroundedTorso(rig, config, gait, pelvis, pelvisRotation, elapsedSeconds);
  const torso = resolveActionTorso(rig, baseTorso, upperBodyAction);
  const baseLeftArm = resolveGroundedArm(rig, config, gait, torso.leftShoulder, "left", elapsedSeconds);
  const baseRightArm = resolveGroundedArm(rig, config, gait, torso.rightShoulder, "right", elapsedSeconds);
  const { leftArm, rightArm } = resolveActionArms(rig, torso, baseLeftArm, baseRightArm, upperBodyAction);

  return assembleCharacterPose({
    gait,
    head: torso.head,
    headRotation: torso.headRotation,
    leftArm,
    leftLeg,
    neckAnchor: torso.neckAnchor,
    pelvis,
    pelvisRotation,
    rightArm,
    rightLeg,
    spineAnchor: torso.spineAnchor,
    chest: torso.chest,
    chestRotation: torso.chestRotation,
  });
}

function resolveActionTorso(
  rig: ResolvedCharacterRig,
  torso: CharacterTorsoJoints,
  action?: ProceduralCharacterUpperBodyAction,
): CharacterTorsoJoints {
  if (action?.kind === "archer") return resolveArcherTorso(rig, torso, action);
  if (action?.kind === "crossbow") return resolveCrossbowTorso(rig, torso, action);
  if (action?.kind === "melee") return resolveMeleeTorso(rig, torso, action);
  return torso;
}

function resolveActionArms(
  rig: ResolvedCharacterRig,
  torso: CharacterTorsoJoints,
  baseLeftArm: CharacterArmJoints,
  baseRightArm: CharacterArmJoints,
  action?: ProceduralCharacterUpperBodyAction,
): { leftArm: CharacterArmJoints; rightArm: CharacterArmJoints } {
  if (action?.kind === "archer") return resolveArcherArms(rig, torso, baseLeftArm, baseRightArm, action);
  if (action?.kind === "crossbow") return resolveCrossbowArms(rig, torso, baseLeftArm, baseRightArm, action);
  if (action?.kind === "melee") return resolveMeleeArms(rig, torso, baseLeftArm, baseRightArm, action);
  return { leftArm: baseLeftArm, rightArm: baseRightArm };
}

function resolveActionPelvis(
  rig: ResolvedCharacterRig,
  pelvis: Vector3,
  pelvisRotation: Quaternion,
  action?: ProceduralCharacterUpperBodyAction,
): { pelvis: Vector3; pelvisRotation: Quaternion } {
  if (action?.kind !== "melee" || action.mounted) return { pelvis, pelvisRotation };
  const windupWeight = action.windupProgress * (1 - action.strikeProgress);
  const impactWeight = Math.max(action.strikeProgress, action.contactProgress);
  const recoveryWeight = action.followThrough;
  const forward = new Vector3(Math.sin(action.aimYawRadians), 0, Math.cos(action.aimYawRadians));
  const lateral = new Vector3(forward.z, 0, -forward.x);
  const drive = impactWeight * (0.07 + action.stepThrough * 0.16) + recoveryWeight * 0.035;
  const scale = rig.morphology.scale * action.actionWeight;
  const shiftedPelvis = pelvis
    .clone()
    .addScaledVector(forward, (drive - windupWeight * 0.025) * scale)
    .addScaledVector(lateral, (windupWeight * 0.025 - impactWeight * 0.018) * scale);
  shiftedPelvis.y -= (windupWeight * 0.018 + impactWeight * 0.042 + recoveryWeight * 0.024) * scale;
  const actionRotation = new Quaternion().setFromEuler(
    new Euler(
      impactWeight * 0.035,
      (-windupWeight * 0.12 + impactWeight * 0.09 + recoveryWeight * 0.05) * action.torsoWeight,
      (windupWeight * 0.025 - impactWeight * 0.018) * action.torsoWeight,
    ),
  );
  return { pelvis: shiftedPelvis, pelvisRotation: pelvisRotation.clone().multiply(actionRotation) };
}

function resolveCrossbowTorso(
  rig: ResolvedCharacterRig,
  torso: CharacterTorsoJoints,
  action: ProceduralCrossbowUpperBodyPose,
): CharacterTorsoJoints {
  const chestRotation = torso.chestRotation
    .clone()
    .multiply(new Quaternion().setFromEuler(new Euler(-0.035, action.swayRadians, 0)));
  const chest = torso.chest.clone().add(new Vector3(0, action.lift * rig.morphology.scale, 0));
  const chestHalfHeight = rig.parts.chest.halfExtents?.[1] ?? rig.morphology.torsoLength * 0.46;
  const neckAnchor = chest.clone().add(new Vector3(0, chestHalfHeight, 0).applyQuaternion(chestRotation));
  const head = neckAnchor.clone().add(new Vector3(0, rig.morphology.headRadius * 0.95, 0));
  const shoulderOffset = rig.morphology.shoulderWidth * 0.48;
  const shoulderHeight = chestHalfHeight * 0.58;
  const leftShoulder = chest.clone().add(new Vector3(shoulderOffset, shoulderHeight, 0).applyQuaternion(chestRotation));
  const rightShoulder = chest
    .clone()
    .add(new Vector3(-shoulderOffset, shoulderHeight, 0).applyQuaternion(chestRotation));
  return { ...torso, chest, chestRotation, head, leftShoulder, neckAnchor, rightShoulder };
}

function resolveCrossbowArms(
  rig: ResolvedCharacterRig,
  torso: CharacterTorsoJoints,
  baseLeftArm: CharacterArmJoints,
  baseRightArm: CharacterArmJoints,
  action: ProceduralCrossbowUpperBodyPose,
): { leftArm: CharacterArmJoints; rightArm: CharacterArmJoints } {
  const scale = rig.morphology.scale;
  const leftTarget = torso.chest.clone().add(new Vector3(0.27, -0.1, 0.34).multiplyScalar(scale));
  const rightTarget = torso.chest.clone().add(new Vector3(-0.27, -0.1, 0.34).multiplyScalar(scale));
  const leftPole = torso.leftShoulder.clone().add(new Vector3(0.38, -0.08, 0.34).multiplyScalar(scale));
  const rightPole = torso.rightShoulder.clone().add(new Vector3(-0.38, -0.08, 0.34).multiplyScalar(scale));
  return {
    leftArm: solveTwoBoneArm(
      torso.leftShoulder,
      baseLeftArm.wrist.clone().lerp(leftTarget, action.actionWeight),
      leftPole,
      rig.morphology.upperArmLength,
      rig.morphology.forearmLength,
    ),
    rightArm: solveTwoBoneArm(
      torso.rightShoulder,
      baseRightArm.wrist.clone().lerp(rightTarget, action.actionWeight),
      rightPole,
      rig.morphology.upperArmLength,
      rig.morphology.forearmLength,
    ),
  };
}

function resolveArcherTorso(
  rig: ResolvedCharacterRig,
  torso: CharacterTorsoJoints,
  action: ProceduralArcherUpperBodyPose,
): CharacterTorsoJoints {
  const chestRotation = torso.chestRotation.clone();
  const aimRotation = new Quaternion().setFromEuler(
    new Euler(-action.aimPitchRadians * 0.2, -0.55 + action.aimYawRadians * 0.42, action.bowCantRadians * 0.04),
  );
  chestRotation.slerp(torso.chestRotation.clone().multiply(aimRotation), action.actionWeight);

  const chestHalfHeight = rig.parts.chest.halfExtents?.[1] ?? rig.morphology.torsoLength * 0.46;
  const neckAnchor = torso.chest.clone().add(new Vector3(0, chestHalfHeight, 0).applyQuaternion(chestRotation));
  const head = neckAnchor.clone().add(new Vector3(0, rig.morphology.headRadius * 0.95, 0));
  const headAimRotation = new Quaternion().setFromEuler(
    new Euler(-action.aimPitchRadians * 0.72, action.aimYawRadians * 0.58, -action.bowCantRadians * 0.03),
  );
  const headRotation = torso.headRotation
    .clone()
    .slerp(torso.headRotation.clone().multiply(headAimRotation), action.actionWeight);
  const shoulderOffset = rig.morphology.shoulderWidth * 0.48;
  const shoulderHeight = chestHalfHeight * 0.58;
  const leftShoulder = torso.chest
    .clone()
    .add(new Vector3(shoulderOffset, shoulderHeight, 0).applyQuaternion(chestRotation));
  const rightShoulder = torso.chest
    .clone()
    .add(new Vector3(-shoulderOffset, shoulderHeight, 0).applyQuaternion(chestRotation));

  return { ...torso, chestRotation, head, headRotation, leftShoulder, neckAnchor, rightShoulder };
}

function resolveArcherArms(
  rig: ResolvedCharacterRig,
  torso: CharacterTorsoJoints,
  baseLeftArm: CharacterArmJoints,
  baseRightArm: CharacterArmJoints,
  action: ProceduralArcherUpperBodyPose,
): { leftArm: CharacterArmJoints; rightArm: CharacterArmJoints } {
  const scale = rig.morphology.scale;
  const forward = new Vector3(
    Math.sin(action.aimYawRadians) * Math.cos(action.aimPitchRadians),
    Math.sin(action.aimPitchRadians),
    Math.cos(action.aimYawRadians) * Math.cos(action.aimPitchRadians),
  ).normalize();
  const right = new Vector3().crossVectors(Y_AXIS, forward);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  else right.normalize();
  const up = new Vector3().crossVectors(forward, right).normalize();

  const loweredGrip = torso.chest
    .clone()
    .addScaledVector(forward, 0.28 * scale)
    .addScaledVector(up, -0.18 * scale)
    .addScaledVector(right, action.bowGripSide * 0.75 * scale);
  const raisedGrip = torso.chest
    .clone()
    .addScaledVector(forward, action.bowArmExtension * scale)
    .addScaledVector(up, action.bowGripHeight * scale)
    .addScaledVector(right, action.bowGripSide * scale);
  const bowGrip = loweredGrip.lerp(raisedGrip, action.raiseFraction);
  const drawRest = bowGrip.clone().addScaledVector(forward, -0.12 * scale);
  const drawAnchor = bowGrip
    .clone()
    .addScaledVector(forward, -action.drawLength * scale)
    .addScaledVector(up, 0.015 * scale);
  const drawHand = drawRest
    .lerp(drawAnchor, action.drawHandFraction)
    .addScaledVector(forward, -action.followThrough * 0.08 * scale)
    .addScaledVector(right, -action.followThrough * 0.14 * scale);

  const leftTarget = baseLeftArm.wrist.clone().lerp(bowGrip, action.actionWeight);
  const rightTarget = baseRightArm.wrist.clone().lerp(drawHand, action.actionWeight);
  const leftPole = torso.leftShoulder
    .clone()
    .addScaledVector(right, 0.42 * scale)
    .addScaledVector(up, -0.18 * scale)
    .addScaledVector(forward, 0.08 * scale);
  const rightPole = torso.rightShoulder
    .clone()
    .addScaledVector(right, -0.48 * scale)
    .addScaledVector(up, 0.08 * scale)
    .addScaledVector(forward, -0.32 * scale);

  return {
    leftArm: solveTwoBoneArm(
      torso.leftShoulder,
      leftTarget,
      leftPole,
      rig.morphology.upperArmLength,
      rig.morphology.forearmLength,
    ),
    rightArm: solveTwoBoneArm(
      torso.rightShoulder,
      rightTarget,
      rightPole,
      rig.morphology.upperArmLength,
      rig.morphology.forearmLength,
    ),
  };
}

function resolveMeleeTorso(
  rig: ResolvedCharacterRig,
  torso: CharacterTorsoJoints,
  action: ProceduralMeleeUpperBodyPose,
): CharacterTorsoJoints {
  const windupWeight = action.windupProgress * (1 - action.strikeProgress);
  const impactWeight = Math.max(action.strikeProgress, action.contactProgress);
  const followWeight = action.followThrough;
  const styleWeight = action.attackStyle === "slash" ? 1 : 0.68;
  const mountedWeight = action.mounted ? 0.72 : 1;
  const twist =
    (-windupWeight * action.attackArcRadians * 0.34 +
      impactWeight * action.attackArcRadians * 0.24 +
      followWeight * action.attackArcRadians * 0.16) *
    styleWeight *
    mountedWeight;
  const downwardDrive = action.attackStyle === "slash" ? 0 : impactWeight * 0.28 + followWeight * 0.12;
  const actionRotation = new Quaternion().setFromEuler(
    new Euler(
      action.aimPitchRadians * 0.16 + downwardDrive,
      action.aimYawRadians * 0.48 + twist,
      -windupWeight * 0.08 + followWeight * 0.06,
    ),
  );
  const poseWeight = action.actionWeight * action.torsoWeight;
  const chestRotation = torso.chestRotation
    .clone()
    .slerp(torso.chestRotation.clone().multiply(actionRotation), poseWeight);
  const stepDrive = action.stepThrough * impactWeight * (action.mounted ? 0.035 : 0.1) * rig.morphology.scale;
  const chest = torso.chest.clone().add(new Vector3(0, -downwardDrive * 0.05, stepDrive));
  const chestHalfHeight = rig.parts.chest.halfExtents?.[1] ?? rig.morphology.torsoLength * 0.46;
  const neckAnchor = chest.clone().add(new Vector3(0, chestHalfHeight, 0).applyQuaternion(chestRotation));
  const head = neckAnchor.clone().add(new Vector3(0, rig.morphology.headRadius * 0.95, 0));
  const headAim = new Quaternion().setFromEuler(
    new Euler(action.aimPitchRadians * 0.46 - downwardDrive * 0.12, action.aimYawRadians * 0.56, -twist * 0.12),
  );
  const headRotation = torso.headRotation
    .clone()
    .slerp(torso.headRotation.clone().multiply(headAim), action.actionWeight);
  const shoulderOffset = rig.morphology.shoulderWidth * 0.48;
  const shoulderHeight = chestHalfHeight * 0.58;
  const leftShoulder = chest.clone().add(new Vector3(shoulderOffset, shoulderHeight, 0).applyQuaternion(chestRotation));
  const rightShoulder = chest
    .clone()
    .add(new Vector3(-shoulderOffset, shoulderHeight, 0).applyQuaternion(chestRotation));

  return { ...torso, chest, chestRotation, head, headRotation, leftShoulder, neckAnchor, rightShoulder };
}

function resolveMeleeArms(
  rig: ResolvedCharacterRig,
  torso: CharacterTorsoJoints,
  baseLeftArm: CharacterArmJoints,
  baseRightArm: CharacterArmJoints,
  action: ProceduralMeleeUpperBodyPose,
): { leftArm: CharacterArmJoints; rightArm: CharacterArmJoints } {
  const scale = rig.morphology.scale;
  const forward = new Vector3(
    Math.sin(action.aimYawRadians) * Math.cos(action.aimPitchRadians),
    Math.sin(action.aimPitchRadians),
    Math.cos(action.aimYawRadians) * Math.cos(action.aimPitchRadians),
  ).normalize();
  const lateralLeft = new Vector3().crossVectors(Y_AXIS, forward);
  if (lateralLeft.lengthSq() < 1e-8) lateralLeft.set(1, 0, 0);
  else lateralLeft.normalize();
  const up = new Vector3().crossVectors(forward, lateralLeft).normalize();
  const weaponTargets = resolveMeleeWeaponTargets(torso, forward, lateralLeft, up, scale, action);
  const weaponTarget = baseRightArm.wrist
    .clone()
    .lerp(weaponTargets.guard, action.actionWeight)
    .lerp(weaponTargets.windup, action.windupProgress * action.actionWeight)
    .lerp(weaponTargets.contact, action.strikeProgress * action.actionWeight)
    .lerp(weaponTargets.follow, action.followThrough * action.actionWeight);
  const shieldEngagement = Math.max(action.strikeProgress, action.contactProgress, action.followThrough * 0.72);
  const shieldLateral = (action.mounted ? 0.64 : 0.52) + shieldEngagement * (action.mounted ? 0.14 : 0.16);
  const shieldGuard = torso.chest
    .clone()
    .addScaledVector(forward, (action.mounted ? 0.31 : 0.25) * scale)
    .addScaledVector(up, (0.08 + shieldEngagement * 0.06) * scale)
    .addScaledVector(lateralLeft, shieldLateral * scale);
  const emptyHandGuard = torso.chest
    .clone()
    .addScaledVector(forward, 0.18 * scale)
    .addScaledVector(up, -0.18 * scale)
    .addScaledVector(lateralLeft, 0.26 * scale);
  const offhandTarget = action.offhandId === "none" ? emptyHandGuard : shieldGuard;
  const offhandWeight = action.offhandId === "none" ? action.actionWeight * 0.92 : Math.max(0.88, action.actionWeight);
  const leftTarget = baseLeftArm.wrist.clone().lerp(offhandTarget, offhandWeight);
  const rightPole = torso.rightShoulder
    .clone()
    .addScaledVector(lateralLeft, -0.52 * scale)
    .addScaledVector(up, 0.12 * scale)
    .addScaledVector(forward, -0.24 * scale);
  const leftPole = torso.leftShoulder
    .clone()
    .addScaledVector(lateralLeft, 0.48 * scale)
    .addScaledVector(up, -0.16 * scale)
    .addScaledVector(forward, 0.08 * scale);

  return {
    leftArm: solveTwoBoneArm(
      torso.leftShoulder,
      leftTarget,
      leftPole,
      rig.morphology.upperArmLength,
      rig.morphology.forearmLength,
    ),
    rightArm: solveTwoBoneArm(
      torso.rightShoulder,
      weaponTarget,
      rightPole,
      rig.morphology.upperArmLength,
      rig.morphology.forearmLength,
    ),
  };
}

function resolveMeleeWeaponTargets(
  torso: CharacterTorsoJoints,
  forward: Vector3,
  lateralLeft: Vector3,
  up: Vector3,
  scale: number,
  action: ProceduralMeleeUpperBodyPose,
): { contact: Vector3; follow: Vector3; guard: Vector3; windup: Vector3 } {
  const reachScale = clamp(action.reach / 1.45, 0.72, 1.28);
  const arcScale = clamp(action.attackArcRadians / ((118 * Math.PI) / 180), 0.5, 1.5);
  const guard = torso.chest
    .clone()
    .addScaledVector(forward, 0.24 * scale)
    .addScaledVector(up, 0.02 * scale)
    .addScaledVector(lateralLeft, (action.mounted ? -0.42 : -0.27) * scale);
  if (action.attackStyle === "slash") {
    return {
      guard,
      windup: torso.chest
        .clone()
        .addScaledVector(forward, -0.26 * scale)
        .addScaledVector(up, 0.52 * scale)
        .addScaledVector(lateralLeft, -0.62 * arcScale * scale),
      contact: torso.chest
        .clone()
        .addScaledVector(forward, (0.56 * reachScale + action.stepThrough * 0.08) * scale)
        .addScaledVector(up, -0.02 * scale)
        .addScaledVector(lateralLeft, 0.18 * arcScale * scale),
      follow: torso.chest
        .clone()
        .addScaledVector(forward, 0.34 * scale)
        .addScaledVector(up, -0.24 * scale)
        .addScaledVector(lateralLeft, 0.5 * arcScale * scale),
    };
  }

  const mountedDrop = action.mounted ? 0.19 : 0;
  const smashSpread = action.attackStyle === "smash" ? 0.1 : 0;
  const windupLateral = action.attackStyle === "smash" ? -0.34 : -0.48;
  return {
    guard,
    windup: torso.chest
      .clone()
      .addScaledVector(forward, (-0.06 - smashSpread) * scale)
      .addScaledVector(up, (0.68 + smashSpread) * scale)
      .addScaledVector(lateralLeft, windupLateral * scale),
    contact: torso.chest
      .clone()
      .addScaledVector(forward, (0.54 * reachScale + action.stepThrough * 0.08) * scale)
      .addScaledVector(up, (-0.2 - mountedDrop) * scale)
      .addScaledVector(lateralLeft, 0.04 * scale),
    follow: torso.chest
      .clone()
      .addScaledVector(forward, 0.41 * scale)
      .addScaledVector(up, (-0.42 - mountedDrop) * scale)
      .addScaledVector(lateralLeft, 0.22 * scale),
  };
}

function solveTwoBoneArm(
  shoulder: Vector3,
  target: Vector3,
  pole: Vector3,
  upperLength: number,
  forearmLength: number,
): CharacterArmJoints {
  const offset = target.clone().sub(shoulder);
  const rawDistance = Math.max(offset.length(), 1e-6);
  const distance = clamp(
    rawDistance,
    Math.abs(upperLength - forearmLength) + 1e-4,
    (upperLength + forearmLength) * 0.985,
  );
  const direction = offset.multiplyScalar(1 / rawDistance);
  const wrist = shoulder.clone().addScaledVector(direction, distance);
  const along = (upperLength * upperLength - forearmLength * forearmLength + distance * distance) / (2 * distance);
  const bendDistance = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const poleDirection = pole
    .clone()
    .sub(shoulder)
    .addScaledVector(direction, -pole.clone().sub(shoulder).dot(direction));
  if (poleDirection.lengthSq() < 1e-8) poleDirection.set(0, -1, 0);
  poleDirection.normalize();
  const elbow = shoulder.clone().addScaledVector(direction, along).addScaledVector(poleDirection, bendDistance);
  return { elbow, shoulder, wrist };
}

function resolveGroundedPelvis(
  rig: ResolvedCharacterRig,
  config: ProceduralCharacterConfig,
  gait: ProceduralCharacterGaitSignals,
  elapsedSeconds: number,
): Vector3 {
  const morphology = rig.morphology;
  const locomotionWeight = config.animationMode === "idle" ? 0 : 1;
  const breathing = Math.sin(elapsedSeconds * 2.2 + resolveSeededMotionValue(config.seed, 43)) * config.breathing;
  const verticalStep = (0.5 - 0.5 * Math.cos(gait.phaseRadians * 2)) * config.bob * locomotionWeight;
  const leftSupport = resolveSupportWeight(gait.feet.left);
  const rightSupport = resolveSupportWeight(gait.feet.right);
  const supportBalance = (leftSupport - rightSupport) / Math.max(0.25, leftSupport + rightSupport);
  const lateralVariation =
    Math.sin(elapsedSeconds * 0.72 + resolveSeededMotionValue(config.seed, 47) * Math.PI) *
    config.motionVariation *
    0.008;
  const baseHeight = CHARACTER_GROUND_Y + morphology.thighLength + morphology.shinLength - morphology.scale * 0.055;
  return new Vector3(
    supportBalance * config.hipSway * locomotionWeight + lateralVariation,
    baseHeight + verticalStep + breathing,
    Math.sin(gait.phaseRadians * 2 - 0.35) * config.bob * 0.1 * locomotionWeight,
  );
}

function resolveGroundedLeg(
  rig: ResolvedCharacterRig,
  config: ProceduralCharacterConfig,
  gait: ProceduralCharacterGaitSignals,
  pelvis: Vector3,
  side: CharacterFootId,
  resolvePlantTarget?: ProceduralPlantTargetResolver<CharacterFootId>,
  targetPelvis = pelvis,
): CharacterLegJoints {
  const morphology = rig.morphology;
  const sideSign = side === "left" ? 1 : -1;
  const signedHipWidth = morphology.hipWidth * sideSign;
  const hip = pelvis.clone().add(new Vector3(signedHipWidth * 0.5, -0.08, 0));
  const locomotionWeight = config.animationMode === "idle" ? 0 : 1;
  const strideVariation =
    1 + resolveSeededMotionValue(config.seed, side === "left" ? 53 : 59) * config.motionVariation * 0.045;
  const liftVariation =
    1 + resolveSeededMotionValue(config.seed, side === "left" ? 61 : 67) * config.motionVariation * 0.04;
  const stride = config.stride * morphology.scale * (config.animationMode === "run" ? 0.82 : 0.66) * strideVariation;
  const clearance = config.stepHeight * morphology.scale * (config.animationMode === "run" ? 1 : 0.84) * liftVariation;
  const trajectory = resolveOrganicLimbTrajectory(
    gait.feet[side],
    stride * locomotionWeight,
    clearance * locomotionWeight,
    config.footPlant,
    config.animationMode === "run" ? 0.48 : 0.43,
  );
  const ankleTarget = new Vector3(
    targetPelvis.x + signedHipWidth * 0.54,
    CHARACTER_GROUND_Y + trajectory.lift,
    targetPelvis.z + trajectory.forward - (1 - locomotionWeight) * morphology.scale * 0.055,
  );
  if (resolvePlantTarget) {
    ankleTarget.fromArray(resolvePlantTarget(side, gait.feet[side], toVectorTuple(ankleTarget), config.footPlant));
  }
  const solved = solveTwoBoneLeg(hip, ankleTarget, morphology.thighLength, morphology.shinLength, sideSign);
  return { ...solved, cycle: gait.feet[side], hip };
}

function solveTwoBoneLeg(
  hip: Vector3,
  target: Vector3,
  thighLength: number,
  shinLength: number,
  sideSign: number,
): Pick<CharacterLegJoints, "ankle" | "knee"> {
  const offset = target.clone().sub(hip);
  const rawDistance = Math.max(offset.length(), 1e-5);
  const distance = clamp(rawDistance, Math.abs(thighLength - shinLength) + 1e-4, thighLength + shinLength - 1e-4);
  const direction = offset.multiplyScalar(1 / rawDistance);
  const ankle = hip.clone().addScaledVector(direction, distance);
  const along = (thighLength * thighLength - shinLength * shinLength + distance * distance) / (2 * distance);
  const bendDistance = Math.sqrt(Math.max(0, thighLength * thighLength - along * along));
  const bendDirection = new Vector3(sideSign * 0.035, 0, 1).addScaledVector(
    direction,
    -new Vector3(sideSign * 0.035, 0, 1).dot(direction),
  );
  if (bendDirection.lengthSq() < 1e-8) bendDirection.set(0, 1, 0);
  bendDirection.normalize();
  const knee = hip.clone().addScaledVector(direction, along).addScaledVector(bendDirection, bendDistance);
  return { ankle, knee };
}

function resolvePelvisRotation(config: ProceduralCharacterConfig, gait: ProceduralCharacterGaitSignals): Quaternion {
  const locomotionWeight = config.animationMode === "idle" ? 0 : 1;
  const leftSupport = resolveSupportWeight(gait.feet.left);
  const rightSupport = resolveSupportWeight(gait.feet.right);
  const supportBalance = (leftSupport - rightSupport) / Math.max(0.25, leftSupport + rightSupport);
  return new Quaternion().setFromEuler(
    new Euler(
      config.lean * 0.42 * locomotionWeight,
      Math.sin(gait.phaseRadians) * config.torsoTwist * 0.3 * locomotionWeight,
      -supportBalance * config.hipSway * 0.9 * locomotionWeight,
    ),
  );
}

function resolveGroundedTorso(
  rig: ResolvedCharacterRig,
  config: ProceduralCharacterConfig,
  gait: ProceduralCharacterGaitSignals,
  pelvis: Vector3,
  pelvisRotation: Quaternion,
  elapsedSeconds: number,
): CharacterTorsoJoints {
  const morphology = rig.morphology;
  const locomotionWeight = config.animationMode === "idle" ? 0 : 1;
  const pelvisHalfHeight = rig.parts.pelvis.halfExtents?.[1] ?? 0.16;
  const chestHalfHeight = rig.parts.chest.halfExtents?.[1] ?? morphology.torsoLength * 0.46;
  const spineAnchor = pelvis.clone().add(new Vector3(0, pelvisHalfHeight, 0).applyQuaternion(pelvisRotation));
  const chest = spineAnchor.clone().add(new Vector3(0, chestHalfHeight * 0.9, 0).applyQuaternion(pelvisRotation));
  const overlapLag = config.secondaryMotion * 0.18;
  const torsoTwist =
    -Math.sin(gait.phaseRadians - overlapLag) * config.torsoTwist * locomotionWeight +
    Math.sin(elapsedSeconds * 0.48 + resolveSeededMotionValue(config.seed, 73) * Math.PI) *
      config.motionVariation *
      0.012;
  const torsoRoll = Math.sin(gait.phaseRadians - overlapLag) * config.hipSway * 0.7 * locomotionWeight;
  const chestRotation = new Quaternion().setFromEuler(new Euler(config.lean * locomotionWeight, torsoTwist, torsoRoll));
  const neckAnchor = chest.clone().add(new Vector3(0, chestHalfHeight, 0).applyQuaternion(chestRotation));
  const head = neckAnchor.clone().add(new Vector3(0, morphology.headRadius * 0.95, 0));
  const headNod =
    Math.sin(gait.phaseRadians * 2 - overlapLag * 1.8) * config.bob * config.secondaryMotion * 0.42 * locomotionWeight;
  const headRotation = new Quaternion().setFromEuler(
    new Euler(config.lean * 0.16 * locomotionWeight - headNod, torsoTwist * 0.18, -torsoRoll * 0.3),
  );
  const shoulderOffset = morphology.shoulderWidth * 0.48;
  const shoulderHeight = chestHalfHeight * 0.58;
  const leftShoulder = chest.clone().add(new Vector3(shoulderOffset, shoulderHeight, 0).applyQuaternion(chestRotation));
  const rightShoulder = chest
    .clone()
    .add(new Vector3(-shoulderOffset, shoulderHeight, 0).applyQuaternion(chestRotation));
  return { chest, chestRotation, head, headRotation, leftShoulder, neckAnchor, rightShoulder, spineAnchor };
}

function resolveGroundedArm(
  rig: ResolvedCharacterRig,
  config: ProceduralCharacterConfig,
  gait: ProceduralCharacterGaitSignals,
  shoulder: Vector3,
  side: CharacterFootId,
  elapsedSeconds: number,
): CharacterArmJoints {
  const sideSign = side === "left" ? 1 : -1;
  const locomotionWeight = config.animationMode === "idle" ? 0 : config.animationMode === "run" ? 1 : 0.76;
  const sidePhase = gait.phaseRadians + (side === "left" ? 0 : Math.PI);
  const lag = config.secondaryMotion * 0.16;
  const amplitudeVariation =
    1 + resolveSeededMotionValue(config.seed, side === "left" ? 79 : 83) * config.motionVariation * 0.08;
  const idleDrift =
    Math.sin(elapsedSeconds * 0.55 + resolveSeededMotionValue(config.seed, side === "left" ? 89 : 97) * Math.PI) *
    config.motionVariation *
    0.018;
  const harmonicSwing = Math.cos(sidePhase - lag) + Math.sin(sidePhase * 2 - lag * 1.6) * 0.12;
  const swing = harmonicSwing * config.armSwing * locomotionWeight * amplitudeVariation + idleDrift;
  const runBend = config.animationMode === "run" ? 0.58 : 0;
  const elbowBend = 0.16 + runBend + Math.max(0, -Math.cos(sidePhase)) * 0.18 * locomotionWeight;
  const upperDirection = new Vector3(sideSign * 0.035, -rig.morphology.upperArmLength, 0).applyAxisAngle(X_AXIS, swing);
  const elbow = shoulder.clone().add(upperDirection);
  const followThrough = Math.sin(sidePhase - lag * 2.1) * config.secondaryMotion * 0.055 * locomotionWeight;
  const forearmDirection = new Vector3(sideSign * 0.018, -rig.morphology.forearmLength, 0).applyAxisAngle(
    X_AXIS,
    swing - elbowBend + followThrough,
  );
  return { elbow, shoulder, wrist: elbow.clone().add(forearmDirection) };
}

function resolveMountedCharacterPose(
  rig: ResolvedCharacterRig,
  config: ProceduralCharacterConfig,
  elapsedSeconds: number,
  phaseOverride?: number,
  upperBodyAction?: ProceduralCharacterUpperBodyAction,
): ProceduralCharacterPose {
  const morphology = rig.morphology;
  const gait = resolveProceduralCharacterGaitSignals(config, elapsedSeconds, phaseOverride);
  const breathing = Math.sin(elapsedSeconds * 2.2 + resolveSeededMotionValue(config.seed, 101)) * config.breathing;
  const rideWave = Math.sin(gait.phaseRadians * 2);
  const rideRoll = Math.sin(gait.phaseRadians - config.secondaryMotion * 0.14) * config.hipSway * 0.42;
  const pelvis = new Vector3(0, 1.12 + breathing + rideWave * config.bob * 0.22, -0.04);
  const pelvisRotation = new Quaternion().setFromEuler(
    new Euler(-0.08 + config.lean * 0.35 + rideWave * config.bob * 0.24, 0, rideRoll),
  );
  const pelvisHalfHeight = rig.parts.pelvis.halfExtents?.[1] ?? 0.16;
  const chestHalfHeight = rig.parts.chest.halfExtents?.[1] ?? morphology.torsoLength * 0.46;
  const spineAnchor = pelvis.clone().add(new Vector3(0, pelvisHalfHeight, 0).applyQuaternion(pelvisRotation));
  const chest = spineAnchor.clone().add(new Vector3(0, chestHalfHeight * 0.9, 0.015).applyQuaternion(pelvisRotation));
  const chestRotation = new Quaternion().setFromEuler(
    new Euler(config.lean * 0.4 - rideWave * config.bob * config.secondaryMotion * 0.18, 0, -rideRoll * 0.55),
  );
  const neckAnchor = chest.clone().add(new Vector3(0, chestHalfHeight, 0).applyQuaternion(chestRotation));
  const head = neckAnchor.clone().add(new Vector3(0, morphology.headRadius * 0.95, 0));
  const headRotation = new Quaternion().setFromEuler(
    new Euler(-rideWave * config.bob * config.secondaryMotion * 0.12, 0, rideRoll * 0.18),
  );
  const leftLeg = resolveMountedLeg(
    pelvis,
    morphology.hipWidth * 0.56,
    morphology.thighLength,
    morphology.shinLength,
    rideWave,
  );
  const rightLeg = resolveMountedLeg(
    pelvis,
    -morphology.hipWidth * 0.56,
    morphology.thighLength,
    morphology.shinLength,
    -rideWave,
  );
  const shoulderOffset = morphology.shoulderWidth * 0.48;
  const shoulderHeight = chestHalfHeight * 0.58;
  const baseTorso: CharacterTorsoJoints = {
    chest,
    chestRotation,
    head,
    headRotation,
    leftShoulder: chest.clone().add(new Vector3(shoulderOffset, shoulderHeight, 0).applyQuaternion(chestRotation)),
    neckAnchor,
    rightShoulder: chest.clone().add(new Vector3(-shoulderOffset, shoulderHeight, 0).applyQuaternion(chestRotation)),
    spineAnchor,
  };
  const torso = resolveActionTorso(rig, baseTorso, upperBodyAction);
  const baseLeftArm = resolveMountedArm(
    torso.leftShoulder,
    morphology.upperArmLength,
    morphology.forearmLength,
    1,
    rideWave,
  );
  const baseRightArm = resolveMountedArm(
    torso.rightShoulder,
    morphology.upperArmLength,
    morphology.forearmLength,
    -1,
    -rideWave,
  );
  const { leftArm, rightArm } = resolveActionArms(rig, torso, baseLeftArm, baseRightArm, upperBodyAction);

  return assembleCharacterPose({
    chest: torso.chest,
    chestRotation: torso.chestRotation,
    gait,
    head: torso.head,
    headRotation: torso.headRotation,
    leftArm,
    leftLeg: { ...leftLeg, cycle: gait.feet.left },
    neckAnchor: torso.neckAnchor,
    pelvis,
    pelvisRotation,
    rightArm,
    rightLeg: { ...rightLeg, cycle: gait.feet.right },
    spineAnchor: torso.spineAnchor,
  });
}

function resolveMountedLeg(
  pelvis: Vector3,
  signedOffset: number,
  thighLength: number,
  shinLength: number,
  rideWave: number,
) {
  const side = Math.sign(signedOffset) || 1;
  const hip = pelvis.clone().add(new Vector3(signedOffset, -0.06, 0));
  const kneeDirection = new Vector3(side * 0.34, -0.72, 0.44 + rideWave * 0.025)
    .normalize()
    .multiplyScalar(thighLength);
  const knee = hip.clone().add(kneeDirection);
  const ankleDirection = new Vector3(side * 0.08, -0.94, -0.16 + rideWave * 0.018)
    .normalize()
    .multiplyScalar(shinLength);
  return { ankle: knee.clone().add(ankleDirection), hip, knee };
}

function resolveMountedArm(
  shoulder: Vector3,
  upperLength: number,
  forearmLength: number,
  side: number,
  rideWave: number,
) {
  const upperDirection = new Vector3(-side * 0.16, -0.68, 0.72 + rideWave * 0.025)
    .normalize()
    .multiplyScalar(upperLength);
  const elbow = shoulder.clone().add(upperDirection);
  const forearmDirection = new Vector3(-side * 0.08, -0.22 + rideWave * 0.015, 0.97)
    .normalize()
    .multiplyScalar(forearmLength);
  return { elbow, shoulder, wrist: elbow.clone().add(forearmDirection) };
}

function assembleCharacterPose(input: {
  chest: Vector3;
  chestRotation: Quaternion;
  gait: ProceduralCharacterGaitSignals;
  head: Vector3;
  headRotation: Quaternion;
  leftArm: CharacterArmJoints;
  leftLeg: CharacterLegJoints;
  neckAnchor: Vector3;
  pelvis: Vector3;
  pelvisRotation: Quaternion;
  rightArm: CharacterArmJoints;
  rightLeg: CharacterLegJoints;
  spineAnchor: Vector3;
}): ProceduralCharacterPose {
  const parts = {} as Record<CharacterPartId, CharacterPartPose>;
  parts.pelvis = createBoxPose(input.pelvis, input.pelvisRotation, input.pelvis);
  parts.chest = createBoxPose(input.chest, input.chestRotation, input.spineAnchor);
  parts.head = createBoxPose(input.head, input.headRotation, input.neckAnchor);
  parts.upperArmLeft = createSegmentPose(input.leftArm.shoulder, input.leftArm.elbow, input.leftArm.shoulder);
  parts.forearmLeft = createSegmentPose(input.leftArm.elbow, input.leftArm.wrist, input.leftArm.elbow);
  parts.upperArmRight = createSegmentPose(input.rightArm.shoulder, input.rightArm.elbow, input.rightArm.shoulder);
  parts.forearmRight = createSegmentPose(input.rightArm.elbow, input.rightArm.wrist, input.rightArm.elbow);
  parts.thighLeft = createSegmentPose(input.leftLeg.hip, input.leftLeg.knee, input.leftLeg.hip);
  parts.shinLeft = createSegmentPose(input.leftLeg.knee, input.leftLeg.ankle, input.leftLeg.knee);
  parts.thighRight = createSegmentPose(input.rightLeg.hip, input.rightLeg.knee, input.rightLeg.hip);
  parts.shinRight = createSegmentPose(input.rightLeg.knee, input.rightLeg.ankle, input.rightLeg.knee);

  return {
    feet: {
      left: { cycle: input.leftLeg.cycle, target: toVectorTuple(input.leftLeg.ankle) },
      right: { cycle: input.rightLeg.cycle, target: toVectorTuple(input.rightLeg.ankle) },
    },
    phase: input.gait.phaseRadians,
    parts,
    joints: [
      toVectorTuple(input.spineAnchor),
      toVectorTuple(input.neckAnchor),
      toVectorTuple(input.leftArm.shoulder),
      toVectorTuple(input.leftArm.elbow),
      toVectorTuple(input.rightArm.shoulder),
      toVectorTuple(input.rightArm.elbow),
      toVectorTuple(input.leftLeg.hip),
      toVectorTuple(input.leftLeg.knee),
      toVectorTuple(input.rightLeg.hip),
      toVectorTuple(input.rightLeg.knee),
    ],
  };
}

export function isProceduralCharacterPoseFinite(pose: ProceduralCharacterPose): boolean {
  return (
    CHARACTER_PART_IDS.every((partId) => {
      const part = pose.parts[partId];
      return [...part.position, ...part.quaternion, ...part.jointAnchor].every(Number.isFinite);
    }) && Object.values(pose.feet).every((foot) => foot.target.every(Number.isFinite))
  );
}

function resolveSupportWeight(cycle: ProceduralContactCycle): number {
  if (cycle.contact === "swing") return 0;
  return Math.pow(Math.sin(Math.PI * cycle.progress), 0.7);
}

function createSegmentPose(from: Vector3, to: Vector3, jointAnchor: Vector3): CharacterPartPose {
  const direction = to.clone().sub(from);
  const quaternion =
    direction.lengthSq() < 1e-10
      ? new Quaternion()
      : new Quaternion().setFromUnitVectors(Y_AXIS, direction.clone().normalize());
  return {
    position: toVectorTuple(from.clone().add(to).multiplyScalar(0.5)),
    quaternion: toQuaternionTuple(quaternion),
    jointAnchor: toVectorTuple(jointAnchor),
  };
}

function createBoxPose(position: Vector3, quaternion: Quaternion, jointAnchor: Vector3): CharacterPartPose {
  return {
    position: toVectorTuple(position),
    quaternion: toQuaternionTuple(quaternion),
    jointAnchor: toVectorTuple(jointAnchor),
  };
}

function toVectorTuple(vector: Vector3): Vector3Tuple {
  return [vector.x, vector.y, vector.z];
}

function toQuaternionTuple(quaternion: Quaternion): QuaternionTuple {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
