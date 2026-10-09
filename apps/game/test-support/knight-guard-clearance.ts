import { readFileSync } from "node:fs";

import { Group, Quaternion, Vector3, type Object3D } from "three";

import { ProceduralContactReactionController } from "../src/three/characters/collision/procedural-contact-reaction";
import type {
  ProceduralMeleeAttackPhase,
  ProceduralMeleeAttackState,
} from "../src/three/characters/melee/procedural-melee-attack-cycle";
import {
  applyProceduralMeleeConfigPatch,
  createDefaultProceduralMeleeConfig,
} from "../src/three/characters/melee/procedural-melee-config";
import {
  applyProceduralMeleeHitReaction,
  resolveProceduralMeleeUpperBodyPose,
} from "../src/three/characters/melee/procedural-melee-pose";
import {
  ProceduralMeleeController,
  type ProceduralMeleeBearerMotion,
} from "../src/three/characters/melee/procedural-melee-controller";
import type { ProceduralMeleeGuardHolds } from "../src/three/characters/melee/procedural-melee-pose";
import {
  PROCEDURAL_MELEE_OFFHANDS,
  PROCEDURAL_MELEE_WEAPONS,
  type ProceduralMeleeAttackVariantId,
} from "../src/three/characters/melee/procedural-melee-weapon-catalog";
import type { ProceduralCharacterLibrary } from "../src/three/characters/procedural-character-assets";
import { ProceduralCharacterAvatar } from "../src/three/characters/procedural-character-avatar";
import {
  createDefaultProceduralCharacterConfig,
  type ProceduralCharacterConfig,
  type ProceduralCharacterRenderDetail,
} from "../src/three/characters/procedural-character-config";
import {
  resolveProceduralCharacterPose,
  type QuaternionTuple,
  type Vector3Tuple,
} from "../src/three/characters/procedural-character-pose";
import {
  PROCEDURAL_POSE_FILTER_LAG_SECONDS,
  ProceduralCharacterPoseFilter,
} from "../src/three/characters/procedural-character-pose-filter";
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
/** Fraction of the stature at which the Knight's eyes sit. */
const EYE_HEIGHT_RATIO = 0.92;

const SHIELD = PROCEDURAL_MELEE_OFFHANDS.find(({ id }) => id === "t1-knight-default-shield");
const SWORD = PROCEDURAL_MELEE_WEAPONS.find(({ id }) => id === "t1-knight-default-sword");
if (!SHIELD || !SWORD) throw new Error("The T1 Knight Default gear is missing from the catalog");
const SHIELD_RADIUS = SHIELD.visualDiameter / 2;
const BLADE_LENGTH = SWORD.visualLength;

export type KnightMotion = "idle" | "walk" | "run";

/** Everything the clearance criteria are measured from, for one moment. */
export interface GuardClearance {
  armToShield: number;
  bladeToShieldArm: number;
  bladeToHead: number;
  bladeToLegs: number;
  bladeToShield: number;
  bladeToTrunk: number;
  bladeTipHeight: number;
  /** Where the blade's tip is, in the actor's frame. */
  bladeTip: Vector3Tuple;
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
  /**
   * How far each foot's lowest joint (ankle, ball or toe tip) stands above where it stands at rest, with the sole on the
   * floor: negative is through the floor.
   */
  soleHeights: Readonly<Record<"left" | "right", number>>;
}

export interface KnightGuardSample {
  /** The melee attack's phase at the moment. */
  attackPhase: ProceduralMeleeAttackPhase;
  /** The contact reaction's weight at the moment, 0 without one. */
  reactionWeight: number;
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

/** One stretch of a sequence: how the Knight moves, for how long, and what starts at its beginning. */
export interface KnightSequenceStep {
  /** An attack starts as the stretch begins; the melee controller picks which, the weapon's attacks in turn. */
  attack?: true;
  /** A melee hit from the front lands as the stretch begins. */
  hit?: true;
  label: string;
  motion: KnightMotion;
  seconds: number;
}

/** Where the Knight attacks: ahead, at the height the melee controller aims level at. */
const ATTACK_TARGET = new Vector3(0, 1.25, 1.5);
/** A full-strength melee hit, pushing the Knight back. */
const FRONT_HIT = {
  localDirectionX: 0,
  localDirectionY: 0,
  localDirectionZ: -1,
  source: "melee",
  strength: 10,
} as const;
const SAMPLE_EVERY_FRAMES = 2;

/**
 * Runs one figure through the steps in turn, frame by frame, the way the runtime does: the melee controller eases its
 * guards and picks the attack, a contact reaction blends the hit in, the pose filter trails the controller (and is
 * reset when the motion changes), and the declared arms are placed in the chest the figure shows. Samples every other
 * frame unless told otherwise.
 */
export function runKnightSequence(
  subject: KnightGuardSubject,
  steps: readonly KnightSequenceStep[],
  seed = 0,
  sampleEveryFrames = SAMPLE_EVERY_FRAMES,
): KnightGuardSample[] {
  const root = new Group();
  const melee = new ProceduralMeleeController(createKnightMeleeConfig(), false, seed);
  const reactions = new ProceduralContactReactionController();
  const filter = new ProceduralCharacterPoseFilter();
  const samples: KnightGuardSample[] = [];
  let frame = 0;
  let motion: KnightMotion | undefined;
  let visibleChest: QuaternionTuple | undefined;
  for (const step of steps) {
    const posed = { ...subject.config, animationMode: step.motion };
    if (step.motion !== motion) {
      subject.avatar.updateConfig(posed);
      filter.reset();
      motion = step.motion;
    }
    if (step.attack) melee.attack(ATTACK_TARGET);
    if (step.hit) reactions.trigger(FRONT_HIT);
    for (let stepFrame = 0; stepFrame < Math.round(step.seconds * FRAMES_PER_SECOND); stepFrame++, frame++) {
      const delta = 1 / FRAMES_PER_SECOND;
      const meleePose = melee.update(delta, root, BEARER_MOTIONS[step.motion]);
      const reaction = reactions.update(delta);
      const action = applyProceduralMeleeHitReaction(meleePose, reaction?.weight ?? 0);
      subject.avatar.setUpperBodyAction(action);
      const pose = filter.apply(
        resolveProceduralCharacterPose(
          subject.rig,
          posed,
          frame / FRAMES_PER_SECOND,
          undefined,
          undefined,
          action,
          reaction,
          visibleChest,
        ),
        delta,
        posed.secondaryMotion,
      );
      subject.avatar.applyPose(pose);
      visibleChest = pose.parts.chest.quaternion;
      if (stepFrame % sampleEveryFrames !== 0) continue;
      samples.push({
        attackPhase: melee.getStats().phase,
        reactionWeight: reaction?.weight ?? 0,
        clearance: measureGuardClearance(subject),
        label: `${step.label} ${(stepFrame / FRAMES_PER_SECOND).toFixed(2)}s`,
        motion: step.motion,
      });
    }
  }
  return samples;
}

const BEARER_MOTIONS: Record<KnightMotion, ProceduralMeleeBearerMotion> = {
  idle: "standing",
  run: "running",
  walk: "walking",
};

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
    `sole ${mm(min((c) => Math.min(c.soleHeights.left, c.soleHeights.right)))}`,
  ].join(", ");
}

function createKnightMeleeConfig() {
  return applyProceduralMeleeConfigPatch(createDefaultProceduralMeleeConfig("knight"), {
    offhandId: "t1-knight-default-shield",
    weaponId: "t1-knight-default-sword",
  });
}

const NO_GUARD_HOLD: ProceduralMeleeGuardHolds = { guard: 0, move: 0, run: 0 };

function createGuardAction(state: ProceduralMeleeAttackState, holds = NO_GUARD_HOLD, seed = 0) {
  return resolveProceduralMeleeUpperBodyPose({
    aimPitchRadians: 0,
    aimYawRadians: 0,
    attackStyle: "slash",
    config: createKnightMeleeConfig(),
    holds,
    mounted: false,
    seed,
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
    bladeTip: [bladeSegment.end.x, bladeSegment.end.y, bladeSegment.end.z],
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
    soleHeights: { left: measureSoleHeight(asset.gltf.scene, "l"), right: measureSoleHeight(asset.gltf.scene, "r") },
  };
}

function measureSoleHeight(scene: Object3D, side: "l" | "r"): number {
  return Math.min(
    ...[`foot_${side}`, `ball_${side}`, `ball_leaf_${side}`].map(
      (name) => requireBone(scene, name).getWorldPosition(new Vector3()).y - restPosition(name).y,
    ),
  );
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

/** The Knight's states as `poses.json` names them. */
export type KnightStateName =
  | "idle-relaxed"
  | "idle-at-ease"
  | "sword-on-shoulder"
  | "guard"
  | "walk-guard"
  | "run-guard"
  | "hit"
  | `${"cut" | "backhand" | "chop" | "thrust"}-${"windup" | "contact" | "follow"}`;

interface KnightStateDrive {
  animationMode: "idle" | "walk" | "run";
  hitWeight: number;
  holds: ProceduralMeleeGuardHolds;
  seed: number;
  state: ProceduralMeleeAttackState;
}

const IDLE_STATE: ProceduralMeleeAttackState = {
  attackGeneration: 0,
  contactCount: 0,
  phase: "idle",
  phaseElapsedSeconds: 0,
};
/**
 * The idle states the catalog declares, in its order (a bearer's seed picks one). `idle-at-ease` is measured in
 * poses.json but not declared: relaxing to it from guard the shield's rim swings 5.1 mm into the thigh.
 */
export const KNIGHT_DECLARED_IDLES: readonly KnightStateName[] = ["idle-relaxed", "sword-on-shoulder"];
const IDLE_SEEDS: Partial<Record<KnightStateName, number>> = Object.fromEntries(
  KNIGHT_DECLARED_IDLES.map((name, seed) => [name, seed]),
);

/** The inputs that reach a state fully: the end of each phase, so its weights are fully reached. */
function resolveStateDrive(name: KnightStateName): KnightStateDrive {
  const standing = { animationMode: "idle" as const, hitWeight: 0, holds: NO_GUARD_HOLD, seed: 0, state: IDLE_STATE };
  const idleSeed = IDLE_SEEDS[name];
  if (idleSeed !== undefined) return { ...standing, seed: idleSeed };
  if (name === "guard") return { ...standing, holds: { guard: 1, move: 0, run: 0 } };
  if (name === "walk-guard") return { ...standing, animationMode: "walk", holds: { guard: 1, move: 1, run: 0 } };
  if (name === "run-guard") return { ...standing, animationMode: "run", holds: { guard: 1, move: 1, run: 1 } };
  if (name === "hit") return { ...standing, hitWeight: 1 };
  const [variant, moment] = name.split("-") as [ProceduralMeleeAttackVariantId, "windup" | "contact" | "follow"];
  return { ...standing, state: resolveMomentReachedAfterLead(variant, moment) };
}

/**
 * The attack state whose look ahead (declared poses lead the attack by the pose filter's lag) lands at the end of the
 * moment's phase, so the declared weights of that moment are fully reached: windup at the end of the windup, contact at
 * the end of the strike, follow at the end of the follow-through.
 */
function resolveMomentReachedAfterLead(
  variant: ProceduralMeleeAttackVariantId,
  moment: "windup" | "contact" | "follow",
): ProceduralMeleeAttackState {
  const config = createKnightMeleeConfig();
  const phase = ({ windup: "windup", contact: "strike", follow: "followThrough" } as const)[moment];
  const duration = {
    followThrough: config.followThroughSeconds,
    strike: config.strikeSeconds,
    windup: config.windupSeconds,
  }[phase];
  return {
    attackGeneration: 1,
    contactCount: moment === "follow" ? 1 : 0,
    phase,
    phaseElapsedSeconds: duration - PROCEDURAL_POSE_FILTER_LAG_SECONDS,
    variant,
  };
}

const SETTLE_FRAMES = 40;

/**
 * Drives the pose function with injected guard holds, seed and attack state (not the melee controller) so the state
 * is fully reached, holds it through the pose filter until it has settled, as the runtime shows it (the declared arms
 * placed in the visible chest), and measures it.
 */
export function measureKnightState(
  subject: KnightGuardSubject,
  name: KnightStateName,
): { arms: KnightArmStateMeasure; body: KnightBodyStateMeasure; clearance: GuardClearance } {
  const gait = settleKnightState(subject, name);
  return { arms: measureArms(subject), body: measureBody(subject, gait), clearance: measureGuardClearance(subject) };
}

/** Where the trunk, head and feet are, in the terms poses.json declares them in (degrees, fractions and metres). */
export interface KnightBodyStateMeasure {
  /** Each ankle forward and left of where the game's idle feet meet. */
  ankles: Record<"left" | "right", { forward: number; left: number }>;
  head: { pitch: number; yaw: number };
  pelvis: { height: number; pitch: number; roll: number; yaw: number };
  soleHeights: Readonly<Record<"left" | "right", number>>;
  spine: { flex: number; side: number; twist: number };
}

/**
 * The gait's own turns of pelvis, chest and head at the moment measured, through a pose filter of their own: a
 * declared body is turned from them, and the figure shows both through the filter.
 */
interface GaitTurns {
  chest: Quaternion;
  head: Quaternion;
  pelvis: Quaternion;
}

function settleKnightState(subject: KnightGuardSubject, name: KnightStateName): GaitTurns {
  const drive = resolveStateDrive(name);
  const posed = { ...subject.config, animationMode: drive.animationMode };
  subject.avatar.updateConfig(posed);
  const action = applyProceduralMeleeHitReaction(
    createGuardAction(drive.state, drive.holds, drive.seed),
    drive.hitWeight,
  );
  subject.avatar.setUpperBodyAction(action);
  const filter = new ProceduralCharacterPoseFilter();
  const gaitFilter = new ProceduralCharacterPoseFilter();
  let gait = resolveProceduralCharacterPose(subject.rig, posed, 0).parts;
  let visibleChest: QuaternionTuple | undefined;
  for (let frame = 0; frame < SETTLE_FRAMES; frame++) {
    const plain = resolveProceduralCharacterPose(subject.rig, posed, frame / FRAMES_PER_SECOND);
    gait = gaitFilter.apply(plain, 1 / FRAMES_PER_SECOND, posed.secondaryMotion).parts;
    const pose = filter.apply(
      resolveProceduralCharacterPose(
        subject.rig,
        posed,
        frame / FRAMES_PER_SECOND,
        undefined,
        undefined,
        action,
        undefined,
        visibleChest,
      ),
      1 / FRAMES_PER_SECOND,
      posed.secondaryMotion,
    );
    subject.avatar.applyPose(pose);
    visibleChest = pose.parts.chest.quaternion;
  }
  return {
    chest: new Quaternion(...gait.chest.quaternion),
    head: new Quaternion(...gait.head.quaternion),
    pelvis: new Quaternion(...gait.pelvis.quaternion),
  };
}

/**
 * The pelvis turn against the gait's, the chest against the gait's chest turned by that pelvis, the head against the
 * gait's head turned by both: the terms a declared body composes its turns in.
 */
function measureBody(subject: KnightGuardSubject, gait: GaitTurns): KnightBodyStateMeasure {
  const scene = subject.asset.gltf.scene;
  const worldTurn = (name: string) => requireBone(scene, name).getWorldQuaternion(new Quaternion());
  const pelvisTurn = gait.pelvis.clone().invert().multiply(worldTurn("pelvis"));
  const spineTurn = gait.chest.clone().multiply(pelvisTurn).invert().multiply(worldTurn("spine_03"));
  const headTurn = gait.head.clone().multiply(pelvisTurn).multiply(spineTurn).invert().multiply(worldTurn("Head"));
  const restPelvisHeight = subject.rig.morphology.restPelvisHeight;
  if (restPelvisHeight === undefined) throw new Error("The Knight rig has no rest pelvis height");
  const originForward = -subject.rig.morphology.scale * 0.055;
  const ankle = (side: "l" | "r") => {
    const position = requireBone(scene, `foot_${side}`).getWorldPosition(new Vector3());
    return { forward: position.z - originForward, left: position.x };
  };
  const pelvis = orient(pelvisTurn);
  const spine = orient(spineTurn);
  const head = orient(headTurn);
  return {
    ankles: { left: ankle("l"), right: ankle("r") },
    head: { pitch: head.pitch, yaw: head.yaw },
    pelvis: { ...pelvis, height: requireBone(scene, "pelvis").getWorldPosition(new Vector3()).y / restPelvisHeight },
    soleHeights: { left: measureSoleHeight(scene, "l"), right: measureSoleHeight(scene, "r") },
    spine: { flex: spine.pitch, side: spine.roll, twist: spine.yaw },
  };
}

/** Yaw (left positive), pitch (leaning forward positive) and roll (the left side down positive) of a turn, in degrees. */
function orient(turn: Quaternion): { pitch: number; roll: number; yaw: number } {
  const forward = new Vector3(0, 0, 1).applyQuaternion(turn);
  const left = new Vector3(1, 0, 0).applyQuaternion(turn);
  return {
    pitch: radiansToDegrees(Math.asin(Math.min(1, Math.max(-1, -forward.y)))),
    roll: radiansToDegrees(Math.asin(Math.min(1, Math.max(-1, -left.y)))),
    yaw: radiansToDegrees(Math.atan2(forward.x, forward.z)),
  };
}

function requireBone(scene: Object3D, name: string): Object3D {
  const bone = scene.getObjectByName(name);
  if (!bone) throw new Error(`The Knight skeleton has no ${name} bone`);
  return bone;
}

function measureArms(subject: KnightGuardSubject): KnightArmStateMeasure {
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
