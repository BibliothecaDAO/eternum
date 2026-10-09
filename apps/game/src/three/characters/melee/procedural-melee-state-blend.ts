import { Quaternion, Vector3 } from "three";

import type {
  ProceduralMeleeArmPose,
  ProceduralMeleeAttackMoments,
  ProceduralMeleeAttackVariantId,
  ProceduralMeleeBodyPose,
  ProceduralMeleeBodyStates,
  ProceduralMeleeFootPlacement,
  ProceduralMeleeStates,
} from "./procedural-melee-weapon-catalog";

/** How far the bearer has moved on from its idle state: the weights of the chain idle, guard, windup, contact, follow. */
export interface ProceduralMeleeStateWeights {
  /** Towards guard: the attack's action weight, or a guard held for another reason, whichever is more. */
  guardWeight: number;
  /** How far the guard is the one held on the move, and of that how far the one held running. */
  moveHold: number;
  runHold: number;
  /** The bearer's seed: it holds the idle variant the seed picks. */
  seed: number;
  /** The attack's moments, each already scaled by the attack's action weight. */
  windup: number;
  contact: number;
  follow: number;
  /** The attack being made; absent before the first, when the attack's weights are all zero. */
  variant?: ProceduralMeleeAttackVariantId;
}

/** The body as gear holds it for the moment, with how far each foot is lifted while it steps between stances (0 to 1). */
export interface ProceduralMeleeHeldBody extends ProceduralMeleeBodyPose {
  footLift: Readonly<Record<"left" | "right", number>>;
}

type ProceduralMeleeFootId = "left" | "right";

/** A foot steps, rather than slides, when a state moves it forward by more than this, in metres. */
const STEPPING_FORWARD_DISTANCE = 0.02;

const scratchPosition = new Vector3();
const scratchTurn = new Quaternion();

/**
 * The arm's pose for the moment: the bearer's idle variant, then towards guard by the guard weight (the running guard
 * by how far it runs), then windup, contact and follow by the attack's weights. Positions lerp, the hand's turn slerps.
 */
export function blendProceduralMeleeArmStates(
  states: ProceduralMeleeStates<ProceduralMeleeArmPose>,
  weights: ProceduralMeleeStateWeights,
): ProceduralMeleeArmPose {
  const guard = lerpProceduralMeleeArmPose(states.guard, states.runGuard, weights.runHold);
  return resolveStateChain(states, guard, weights).reduce(
    (pose, [target, weight]) => lerpProceduralMeleeArmPose(pose, target, weight),
    pickIdleVariant(states, weights.seed),
  );
}

/**
 * The body's pose for the moment, along the arms' chain; its guard is the standing one, or on the move the walking
 * guard turning into the running one. A foot a state moves forward lifts on the way, so it steps there.
 */
export function blendProceduralMeleeBodyStates(
  states: ProceduralMeleeBodyStates,
  weights: ProceduralMeleeStateWeights,
): ProceduralMeleeHeldBody {
  const movingGuard = lerpBodyPose(states.walkGuard, states.runGuard, weights.runHold);
  const guard = lerpBodyPose(states.guard, movingGuard, weights.moveHold);
  return resolveStateChain(states, guard, weights).reduce(
    (body, [target, weight]) => stepProceduralMeleeBody(body, target, weight),
    holdBody(pickIdleVariant(states, weights.seed)),
  );
}

/** Moves the held body towards another pose by `weight`, lifting a foot that pose moves forward. */
export function stepProceduralMeleeBody(
  body: ProceduralMeleeHeldBody,
  to: ProceduralMeleeBodyPose,
  weight: number,
): ProceduralMeleeHeldBody {
  return {
    ...lerpBodyPose(body, to, weight),
    footLift: {
      left: resolveFootLift(body, to, "left", weight),
      right: resolveFootLift(body, to, "right", weight),
    },
  };
}

function pickIdleVariant<T>(states: ProceduralMeleeStates<T>, seed: number): T {
  return states.idle[(seed >>> 0) % states.idle.length];
}

function resolveStateChain<T>(
  states: ProceduralMeleeStates<T>,
  guard: T,
  weights: ProceduralMeleeStateWeights,
): (readonly [T, number])[] {
  const chain: (readonly [T, number])[] = [[guard, weights.guardWeight]];
  if (!weights.variant) return chain;
  const attack = requireAttackMoments(states, weights.variant);
  return [
    ...chain,
    [attack.windup, weights.windup],
    [attack.contact, weights.contact],
    [attack.follow, weights.follow],
  ];
}

function requireAttackMoments<T>(
  states: ProceduralMeleeStates<T>,
  variant: ProceduralMeleeAttackVariantId,
): ProceduralMeleeAttackMoments<T> {
  const attack = states.attacks[variant];
  if (!attack) throw new Error(`The gear declares no states for a ${variant} attack`);
  return attack;
}

function holdBody(pose: ProceduralMeleeBodyPose): ProceduralMeleeHeldBody {
  return { ...pose, footLift: { left: 0, right: 0 } };
}

/** The lift is highest halfway between the two stances, and the foot is down at either end. */
function resolveFootLift(
  body: ProceduralMeleeHeldBody,
  to: ProceduralMeleeBodyPose,
  foot: ProceduralMeleeFootId,
  weight: number,
): number {
  const stepsForward = to.stance[foot].forward - body.stance[foot].forward > STEPPING_FORWARD_DISTANCE;
  const lift = stepsForward ? Math.sin(Math.PI * clampUnit(weight)) : 0;
  return Math.max(body.footLift[foot] * (1 - clampUnit(weight)), lift);
}

/**
 * How far, in metres in the chest's frame (+X left, +Z forward), the shield arm's wrist bows out of the straight line
 * between an idle and the guard or hit: a straight line takes a shield hung at the side through the thigh while the feet
 * step back under the body.
 */
const SHIELD_ARM_BOW: readonly [number, number, number] = [0.045, 0, 0.02];

/** Bows the wrist out by `sin(pi w)` of the shield arm's bow, `w` the weight that moves it between the two states. */
export function bowProceduralMeleeArmPose(pose: ProceduralMeleeArmPose, weight: number): ProceduralMeleeArmPose {
  const bow = Math.sin(Math.PI * clampUnit(weight));
  const [x, y, z] = pose.wrist;
  return { ...pose, wrist: [x + SHIELD_ARM_BOW[0] * bow, y + SHIELD_ARM_BOW[1] * bow, z + SHIELD_ARM_BOW[2] * bow] };
}

/** Positions lerp, the hand's turn slerps. */
export function lerpProceduralMeleeArmPose(
  from: ProceduralMeleeArmPose,
  to: ProceduralMeleeArmPose,
  weight: number,
): ProceduralMeleeArmPose {
  return {
    elbow: scratchPosition
      .set(...from.elbow)
      .lerp(new Vector3(...to.elbow), weight)
      .toArray(),
    handTurn: scratchTurn
      .set(...from.handTurn)
      .slerp(new Quaternion(...to.handTurn), weight)
      .normalize()
      .toArray() as [number, number, number, number],
    wrist: scratchPosition
      .set(...from.wrist)
      .lerp(new Vector3(...to.wrist), weight)
      .toArray(),
  };
}

/** Degrees, positions and stances lerp: the angles between states are small, and each is turned from the same frame. */
function lerpBodyPose(
  from: ProceduralMeleeBodyPose,
  to: ProceduralMeleeBodyPose,
  weight: number,
): ProceduralMeleeBodyPose {
  return {
    head: lerpFields(from.head, to.head, weight),
    pelvis: lerpFields(from.pelvis, to.pelvis, weight),
    spine: lerpFields(from.spine, to.spine, weight),
    stance: {
      left: lerpFields<ProceduralMeleeFootPlacement>(from.stance.left, to.stance.left, weight),
      right: lerpFields<ProceduralMeleeFootPlacement>(from.stance.right, to.stance.right, weight),
    },
  };
}

function lerpFields<T extends Readonly<Record<keyof T, number>>>(from: T, to: T, weight: number): T {
  const keys = Object.keys(from) as (keyof T)[];
  return Object.fromEntries(keys.map((key) => [key, from[key] + (to[key] - from[key]) * weight])) as T;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
