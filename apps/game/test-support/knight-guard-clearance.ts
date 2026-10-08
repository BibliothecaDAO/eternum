import { readFileSync } from "node:fs";

import { Quaternion, Vector3, type Object3D } from "three";

import {
  advanceProceduralMeleeAttack,
  createIdleProceduralMeleeAttackState,
  startProceduralMeleeAttack,
  type ProceduralMeleeAttackState,
} from "../src/three/characters/melee/procedural-melee-attack-cycle";
import {
  applyProceduralMeleeConfigPatch,
  createDefaultProceduralMeleeConfig,
} from "../src/three/characters/melee/procedural-melee-config";
import { resolveProceduralMeleeUpperBodyPose } from "../src/three/characters/melee/procedural-melee-pose";
import {
  PROCEDURAL_MELEE_OFFHANDS,
  PROCEDURAL_MELEE_WEAPONS,
} from "../src/three/characters/melee/procedural-melee-weapon-catalog";
import type { ProceduralCharacterLibrary } from "../src/three/characters/procedural-character-assets";
import { ProceduralCharacterAvatar } from "../src/three/characters/procedural-character-avatar";
import {
  createDefaultProceduralCharacterConfig,
  type ProceduralCharacterConfig,
  type ProceduralCharacterRenderDetail,
} from "../src/three/characters/procedural-character-config";
import { resolveProceduralCharacterPose } from "../src/three/characters/procedural-character-pose";
import {
  applyCharacterRigLimbLengths,
  resolveCharacterRig,
  type ResolvedCharacterRig,
} from "../src/three/characters/procedural-character-rig";

/** Thicknesses and radii of the stand-in shapes the clearance is measured with, in metres. */
const SHIELD_THICKNESS = 0.01;
const ARM_RADIUS = 0.02;
const TRUNK_RADIUS = 0.05;
const LIMB_RADIUS = 0.03;
const SAMPLES_PER_SEGMENT = 64;
const FRAMES_PER_SECOND = 60;
/** Eight sample times, in frames, into each locomotion mode. */
export const LOCOMOTION_SAMPLE_FRAMES = [6, 11, 16, 21, 26, 31, 36, 41] as const;
export const ATTACK_SAMPLE_COUNT = 40;
/** Fraction of the stature at which the Knight's eyes sit. */
const EYE_HEIGHT_RATIO = 0.92;

const SHIELD = PROCEDURAL_MELEE_OFFHANDS.find(({ id }) => id === "t1-knight-default-shield");
const SWORD = PROCEDURAL_MELEE_WEAPONS.find(({ id }) => id === "t1-knight-default-sword");
if (!SHIELD || !SWORD) throw new Error("The T1 Knight Default gear is missing from the catalog");
const SHIELD_RADIUS = SHIELD.visualDiameter / 2;
const BLADE_LENGTH = SWORD.visualLength;

export type KnightMotion = "idle" | "walk" | "run" | "attack";

/** Everything the criteria of work order M are measured from, for one moment. */
export interface GuardClearance {
  armToShield: number;
  bladeToShieldArm: number;
  bladeToHead: number;
  bladeToLegs: number;
  bladeToShield: number;
  bladeToTrunk: number;
  bladeTipHeight: number;
  /** Degrees between the blade and straight up. */
  bladeVerticalDegrees: number;
  /** The blade's x component: positive leans towards the body's midline from the right hand. */
  bladeLeanInward: number;
  /** Largest of the elbow's and the wrist's distance in front of the shield's plane; negative is behind it. */
  forearmInFrontOfShield: number;
  /** Degrees the sword arm's two segments' hinge axes differ, larger of the two arms. */
  hingeAxisDegrees: number;
  /** Shield's rightmost point minus the midline of the shoulders: negative is left of it. */
  shieldRightmostFromMidline: number;
  shieldToHead: number;
  shieldToLegs: number;
  shieldToTrunk: number;
  /** Degrees the shield's front is turned to the left of forward; negative is to the right. */
  shieldTurnLeftDegrees: number;
  shieldTopBelowEyes: number;
  shieldUprightDegrees: number;
}

export interface KnightGuardSample {
  clearance: GuardClearance;
  label: string;
  motion: KnightMotion;
}

export interface KnightGuardSubject {
  asset: ReturnType<ProceduralCharacterLibrary["instantiate"]>;
  avatar: ProceduralCharacterAvatar;
  config: ProceduralCharacterConfig;
  headRadius: number;
  rig: ResolvedCharacterRig;
  stature: number;
}

export function createKnightGuardSubject(
  library: ProceduralCharacterLibrary,
  renderDetail: ProceduralCharacterRenderDetail,
  stature: number,
): KnightGuardSubject {
  const config = {
    ...createDefaultProceduralCharacterConfig(),
    appearanceId: "t1-knight-default" as const,
    renderDetail,
    tier: 1 as const,
  };
  const asset = library.instantiate(config.appearanceId, config.tier, renderDetail);
  const avatar = new ProceduralCharacterAvatar(asset, resolveCharacterRig(config), config);
  const rig = applyCharacterRigLimbLengths(resolveCharacterRig(config), avatar.measureActiveLimbLengths());
  avatar.rebuild(rig, config);
  return { asset, avatar, config, headRadius: rig.morphology.headRadius, rig, stature };
}

/** Samples idle, walk or run frame by frame, as the runtime does, at the eight sample times. */
export function sampleLocomotionGuard(
  subject: KnightGuardSubject,
  motion: "idle" | "walk" | "run",
): KnightGuardSample[] {
  const posed = { ...subject.config, animationMode: motion };
  subject.avatar.updateConfig(posed);
  const action = createGuardAction({ ...createIdleProceduralMeleeAttackState() });
  subject.avatar.setUpperBodyAction(action);
  const samples: KnightGuardSample[] = [];
  for (let frame = 0; frame <= LOCOMOTION_SAMPLE_FRAMES[LOCOMOTION_SAMPLE_FRAMES.length - 1]; frame++) {
    subject.avatar.applyPose(
      resolveProceduralCharacterPose(subject.rig, posed, frame / FRAMES_PER_SECOND, undefined, undefined, action),
    );
    if (!(LOCOMOTION_SAMPLE_FRAMES as readonly number[]).includes(frame)) continue;
    samples.push({
      clearance: measureGuardClearance(subject),
      label: `${motion} ${(frame / FRAMES_PER_SECOND).toFixed(2)}s`,
      motion,
    });
  }
  return samples;
}

/** Samples the attack cycle, from acquire to recover, at evenly spaced frames. */
export function sampleAttackCycle(subject: KnightGuardSubject): KnightGuardSample[] {
  const posed = { ...subject.config, animationMode: "idle" as const };
  subject.avatar.updateConfig(posed);
  const meleeConfig = createKnightMeleeConfig();
  let state: ProceduralMeleeAttackState = startProceduralMeleeAttack(createIdleProceduralMeleeAttackState());
  const cycle: { action: ReturnType<typeof createGuardAction>; clearance: GuardClearance }[] = [];
  for (let frame = 0; state.phase !== "idle" && frame < 600; frame++) {
    const action = createGuardAction(state);
    subject.avatar.setUpperBodyAction(action);
    subject.avatar.applyPose(
      resolveProceduralCharacterPose(subject.rig, posed, frame / FRAMES_PER_SECOND, undefined, undefined, action),
    );
    cycle.push({ action, clearance: measureGuardClearance(subject) });
    state = advanceProceduralMeleeAttack(state, meleeConfig, 1 / FRAMES_PER_SECOND, false).state;
  }
  return Array.from({ length: ATTACK_SAMPLE_COUNT }, (_, index) => {
    const frame = Math.round((index * (cycle.length - 1)) / (ATTACK_SAMPLE_COUNT - 1));
    return { clearance: cycle[frame].clearance, label: `attack frame ${frame}`, motion: "attack" as const };
  });
}

/** The worst value of every criterion over the samples, as a one-line summary for failure messages. */
export function summariseWorstGuardClearance(samples: readonly KnightGuardSample[]): string {
  const clearances = samples.map(({ clearance }) => clearance);
  const min = (pick: (clearance: GuardClearance) => number) => Math.min(...clearances.map(pick));
  const max = (pick: (clearance: GuardClearance) => number) => Math.max(...clearances.map(pick));
  const mm = (metres: number) => `${(metres * 1000).toFixed(0)}mm`;
  return [
    `blade-shield ${mm(min((c) => c.bladeToShield))}`,
    `arm-shield ${mm(min((c) => c.armToShield))}`,
    `blade-shield-arm ${mm(min((c) => c.bladeToShieldArm))}`,
    `blade-head ${mm(min((c) => c.bladeToHead))}`,
    `blade-trunk ${mm(min((c) => c.bladeToTrunk))}`,
    `blade-legs ${mm(min((c) => c.bladeToLegs))}`,
    `tip-height ${mm(min((c) => c.bladeTipHeight))}`,
    `shield-head ${mm(min((c) => c.shieldToHead))}`,
    `shield-trunk ${mm(min((c) => c.shieldToTrunk))}`,
    `shield-legs ${mm(min((c) => c.shieldToLegs))}`,
    `turn-left ${min((c) => c.shieldTurnLeftDegrees).toFixed(0)}..${max((c) => c.shieldTurnLeftDegrees).toFixed(0)}deg`,
    `upright ${max((c) => c.shieldUprightDegrees).toFixed(0)}deg`,
    `rightmost ${mm(max((c) => c.shieldRightmostFromMidline))}`,
    `rim-below-eyes ${mm(min((c) => c.shieldTopBelowEyes))}`,
    `forearm-in-front ${mm(max((c) => c.forearmInFrontOfShield))}`,
    `blade-vertical ${max((c) => c.bladeVerticalDegrees).toFixed(0)}deg`,
    `blade-inward ${max((c) => c.bladeLeanInward).toFixed(2)}`,
    `hinge ${max((c) => c.hingeAxisDegrees).toFixed(1)}deg`,
  ].join(", ");
}

function createKnightMeleeConfig() {
  return applyProceduralMeleeConfigPatch(createDefaultProceduralMeleeConfig("knight"), {
    offhandId: "t1-knight-default-shield",
    weaponId: "t1-knight-default-sword",
  });
}

function createGuardAction(state: ProceduralMeleeAttackState) {
  return resolveProceduralMeleeUpperBodyPose({
    aimPitchRadians: 0,
    aimYawRadians: 0,
    attackStyle: "slash",
    config: createKnightMeleeConfig(),
    mounted: false,
    state,
  });
}

function measureGuardClearance(subject: KnightGuardSubject): GuardClearance {
  const { asset, avatar } = subject;
  const joints = avatar.readWorldDiagnosticJoints();
  const point = (tuple: readonly number[]) => new Vector3(tuple[0], tuple[1], tuple[2]);
  const shieldCentre = new Vector3();
  const shieldRotation = new Quaternion();
  avatar.writeSocketWorldTransform("forearmLeft", shieldCentre, shieldRotation);
  const shieldFront = new Vector3(0, 0, 1).applyQuaternion(shieldRotation);
  const gripPosition = new Vector3();
  const gripRotation = new Quaternion();
  avatar.writeSocketWorldTransform("gripRight", gripPosition, gripRotation);
  const blade = new Vector3(0, 1, 0).applyQuaternion(gripRotation);
  const bladeSegment = segment(gripPosition, gripPosition.clone().addScaledVector(blade, BLADE_LENGTH));
  const neck = asset.gltf.scene.getObjectByName("neck_01")?.getWorldPosition(new Vector3());
  if (!neck) throw new Error("The Knight skeleton has no neck_01 bone");

  const shield = { centre: shieldCentre, front: shieldFront };
  const sword = [
    segment(point(joints.elbowRight), point(joints.wristRight)),
    segment(point(joints.wristRight), gripPosition),
  ];
  const shieldArm = [
    segment(point(joints.shoulderLeft), point(joints.elbowLeft)),
    segment(point(joints.elbowLeft), point(joints.wristLeft)),
  ];
  const trunk = segment(point(joints.pelvis), neck);
  const legs = (["Left", "Right"] as const).flatMap((side) => [
    segment(point(joints[`hip${side}`]), point(joints[`knee${side}`])),
    segment(point(joints[`knee${side}`]), point(joints[`ankle${side}`])),
  ]);
  const head = point(joints.head);
  const eyeHeight = subject.stature * EYE_HEIGHT_RATIO;
  const midline = (joints.shoulderLeft[0] + joints.shoulderRight[0]) / 2;
  const horizontalFront = Math.hypot(shieldFront.x, shieldFront.z);

  return {
    armToShield: Math.min(...sword.map((arm) => segmentToShield(arm, shield) - ARM_RADIUS)),
    bladeToHead: pointToSegmentDistance(head, bladeSegment) - subject.headRadius,
    bladeToLegs: Math.min(...legs.map((leg) => segmentDistance(bladeSegment, leg) - LIMB_RADIUS)),
    bladeToShield: segmentToShield(bladeSegment, shield),
    bladeToShieldArm: Math.min(...shieldArm.map((arm) => segmentDistance(bladeSegment, arm) - ARM_RADIUS)),
    bladeToTrunk: segmentDistance(bladeSegment, trunk) - TRUNK_RADIUS,
    bladeTipHeight: bladeSegment.end.y,
    bladeVerticalDegrees: radiansToDegrees(blade.angleTo(new Vector3(0, 1, 0))),
    bladeLeanInward: blade.x,
    forearmInFrontOfShield: Math.max(
      ...(["elbowLeft", "wristLeft"] as const).map((name) => point(joints[name]).sub(shieldCentre).dot(shieldFront)),
    ),
    hingeAxisDegrees: measureHingeAxisDegrees(asset.gltf.scene),
    shieldRightmostFromMidline: shieldCentre.x - SHIELD_RADIUS * Math.sqrt(1 - shieldFront.x ** 2) - midline,
    shieldToHead: pointToShieldDistance(head, shield) - subject.headRadius,
    shieldToLegs: Math.min(...legs.map((leg) => segmentToShield(leg, shield) - LIMB_RADIUS)),
    shieldToTrunk: segmentToShield(trunk, shield) - TRUNK_RADIUS,
    shieldTurnLeftDegrees: radiansToDegrees(Math.atan2(shieldFront.x, shieldFront.z)),
    shieldTopBelowEyes: eyeHeight - (shieldCentre.y + SHIELD_RADIUS * Math.sqrt(1 - shieldFront.y ** 2)),
    shieldUprightDegrees: radiansToDegrees(
      Math.asin(shieldFront.y / Math.max(1e-9, Math.hypot(horizontalFront, shieldFront.y))),
    ),
  };
}

interface Segment {
  end: Vector3;
  start: Vector3;
}

function segment(start: Vector3, end: Vector3): Segment {
  return { end, start };
}

function samplePoints(line: Segment): Vector3[] {
  return Array.from({ length: SAMPLES_PER_SEGMENT + 1 }, (_, index) =>
    line.start.clone().lerp(line.end, index / SAMPLES_PER_SEGMENT),
  );
}

/** Distance from a point to the shield: a disc of the catalog diameter, 1 cm thick. */
function pointToShieldDistance(point: Vector3, shield: { centre: Vector3; front: Vector3 }): number {
  const offset = point.clone().sub(shield.centre);
  const along = offset.dot(shield.front);
  const radial = offset.addScaledVector(shield.front, -along).length();
  const outside = Math.max(0, radial - SHIELD_RADIUS);
  return Math.hypot(outside, Math.abs(along)) - SHIELD_THICKNESS / 2;
}

function segmentToShield(line: Segment, shield: { centre: Vector3; front: Vector3 }): number {
  return Math.min(...samplePoints(line).map((sample) => pointToShieldDistance(sample, shield)));
}

function pointToSegmentDistance(point: Vector3, line: Segment): number {
  const direction = line.end.clone().sub(line.start);
  const t = Math.min(
    1,
    Math.max(0, point.clone().sub(line.start).dot(direction) / Math.max(1e-12, direction.lengthSq())),
  );
  return point.distanceTo(line.start.clone().addScaledVector(direction, t));
}

function segmentDistance(first: Segment, second: Segment): number {
  return Math.min(...samplePoints(first).map((sample) => pointToSegmentDistance(sample, second)));
}

/** Both arms' upper arm and forearm should keep one hinge axis: the rest axis carried by each bone's own turn. */
function measureHingeAxisDegrees(scene: Object3D): number {
  return Math.max(
    ...(["l", "r"] as const).map((side) => {
      const rest = REST_HINGE_AXES[side];
      const axes = ["upperarm", "lowerarm"].map((bone) =>
        rest
          .clone()
          .applyQuaternion((scene.getObjectByName(`${bone}_${side}`) as Object3D).getWorldQuaternion(new Quaternion())),
      );
      return radiansToDegrees(axes[0].angleTo(axes[1]));
    }),
  );
}

const RUNTIME_FIT = JSON.parse(readFileSync("asset-sources/characters/t1-knight-default/runtime-fit.json", "utf8")) as {
  joints: { name: string; rest_position: [number, number, number] }[];
};

function restPosition(name: string): Vector3 {
  const joint = RUNTIME_FIT.joints.find((candidate) => candidate.name === name);
  if (!joint) throw new Error(`runtime-fit.json has no joint ${name}`);
  return new Vector3(...joint.rest_position);
}

/** The rest hinge axis of an arm, forearm x upper arm, from the rest joints in runtime-fit.json. */
const REST_HINGE_AXES = Object.fromEntries(
  (["l", "r"] as const).map((side) => {
    const shoulder = restPosition(`upperarm_${side}`);
    const elbow = restPosition(`lowerarm_${side}`);
    const wrist = restPosition(`hand_${side}`);
    return [side, wrist.sub(elbow).cross(elbow.sub(shoulder)).normalize()];
  }),
) as Record<"l" | "r", Vector3>;

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export type KnightArmState = "carry" | "guard" | "windup" | "contact" | "follow";

/** Where the arms and gear are in spine_03's frame, relative to the midpoint of the shoulder joints. */
export interface KnightArmStateMeasure {
  blade: Vector3;
  leftElbow: Vector3;
  leftWrist: Vector3;
  rightElbow: Vector3;
  rightWrist: Vector3;
  shieldCentre: Vector3;
  shieldFront: Vector3;
  swordGrip: Vector3;
}

const STATE_ATTACK_MOMENTS: Record<KnightArmState, ProceduralMeleeAttackState> = {
  carry: { attackGeneration: 0, contactCount: 0, phase: "idle", phaseElapsedSeconds: 0 },
  // The end of each phase, so the weights of its state are fully reached.
  guard: { attackGeneration: 1, contactCount: 0, phase: "acquire", phaseElapsedSeconds: 10 },
  windup: { attackGeneration: 1, contactCount: 0, phase: "windup", phaseElapsedSeconds: 10 },
  contact: { attackGeneration: 1, contactCount: 1, phase: "contact", phaseElapsedSeconds: 0 },
  follow: { attackGeneration: 1, contactCount: 1, phase: "followThrough", phaseElapsedSeconds: 10 },
};
const SETTLE_FRAMES = 40;

/** Drives the weights so the state is fully reached, holds it until the arm solver has settled, and measures it. */
export function measureKnightArmState(subject: KnightGuardSubject, state: KnightArmState): KnightArmStateMeasure {
  const posed = { ...subject.config, animationMode: "idle" as const };
  subject.avatar.updateConfig(posed);
  const action = createGuardAction(STATE_ATTACK_MOMENTS[state]);
  subject.avatar.setUpperBodyAction(action);
  for (let frame = 0; frame < SETTLE_FRAMES; frame++) {
    subject.avatar.applyPose(resolveProceduralCharacterPose(subject.rig, posed, 0, undefined, undefined, action));
  }
  const joints = subject.avatar.readWorldDiagnosticJoints();
  const spine = subject.asset.gltf.scene.getObjectByName("spine_03");
  if (!spine) throw new Error("The Knight skeleton has no spine_03 bone");
  const toSpineInverse = spine.getWorldQuaternion(new Quaternion()).invert();
  const middle = new Vector3(...joints.shoulderLeft).add(new Vector3(...joints.shoulderRight)).multiplyScalar(0.5);
  const place = (world: Vector3) => world.clone().sub(middle).applyQuaternion(toSpineInverse);
  const turn = (world: Vector3) => world.clone().applyQuaternion(toSpineInverse);
  const shieldCentre = new Vector3();
  const shieldRotation = new Quaternion();
  subject.avatar.writeSocketWorldTransform("forearmLeft", shieldCentre, shieldRotation);
  const gripPosition = new Vector3();
  const gripRotation = new Quaternion();
  subject.avatar.writeSocketWorldTransform("gripRight", gripPosition, gripRotation);
  return {
    blade: turn(new Vector3(0, 1, 0).applyQuaternion(gripRotation)),
    leftElbow: place(new Vector3(...joints.elbowLeft)),
    leftWrist: place(new Vector3(...joints.wristLeft)),
    rightElbow: place(new Vector3(...joints.elbowRight)),
    rightWrist: place(new Vector3(...joints.wristRight)),
    shieldCentre: place(shieldCentre),
    shieldFront: turn(new Vector3(0, 0, 1).applyQuaternion(shieldRotation)),
    swordGrip: place(gripPosition),
  };
}
