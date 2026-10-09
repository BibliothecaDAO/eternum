import type { ProceduralMeleeConfig } from "./procedural-melee-config";
import { PROCEDURAL_POSE_FILTER_LAG_SECONDS } from "../procedural-character-pose-filter";
import {
  leadProceduralMeleeAttackState,
  resolveProceduralMeleeAttackSignals,
  type ProceduralMeleeAttackState,
} from "./procedural-melee-attack-cycle";
import {
  blendProceduralMeleeArmStates,
  blendProceduralMeleeBodyStates,
  bowProceduralMeleeArmPose,
  lerpProceduralMeleeArmPose,
  stepProceduralMeleeBody,
  type ProceduralMeleeHeldBody,
  type ProceduralMeleeStateWeights,
} from "./procedural-melee-state-blend";
import {
  resolveProceduralMeleeOffhand,
  resolveProceduralMeleeOffhandCarry,
  resolveProceduralMeleeWeapon,
  type ProceduralMeleeArmPose,
  type ProceduralMeleeAttackStyle,
  type ProceduralMeleeBodyPose,
  type ProceduralMeleeOffhandCarry,
  type ProceduralMeleeWeaponId,
} from "./procedural-melee-weapon-catalog";

/** Where gear that declares states holds the arms; an arm is absent when its gear declares none. */
export interface ProceduralMeleeDeclaredArms {
  left?: ProceduralMeleeArmPose;
  right?: ProceduralMeleeArmPose;
}

export interface ProceduralMeleeUpperBodyPose {
  actionWeight: number;
  /**
   * Where the arms of gear that declares states are held, for the moment of the attack, in the chest's own frame. An arm
   * is absent when its gear declares none: the controller then places it with its own targets.
   */
  arms: ProceduralMeleeDeclaredArms;
  aimPitchRadians: number;
  aimYawRadians: number;
  attackArcRadians: number;
  attackStyle: ProceduralMeleeAttackStyle;
  /** Where a weapon that declares body states holds the body, for the moment; absent for other gear. */
  body?: ProceduralMeleeHeldBody;
  contactProgress: number;
  followThrough: number;
  /** The hit reaction of gear that declares states, which a contact reaction blends in by its weight. */
  hit?: { arms: ProceduralMeleeDeclaredArms; body?: ProceduralMeleeBodyPose };
  kind: "melee";
  mounted: boolean;
  /** How the offhand is carried, resolved once from the catalog. */
  offhandCarry: ProceduralMeleeOffhandCarry;
  reach: number;
  stepThrough: number;
  strikeProgress: number;
  torsoWeight: number;
  weaponId: ProceduralMeleeWeaponId;
  windupProgress: number;
}

/**
 * How far gear that declares states is held at guard for a reason other than the attack, each from 0 to 1. The melee
 * controller raises `guard` while the bearer moves on its own legs and for a while after it attacks standing, `move`
 * while it walks or runs and `run` while it runs.
 */
export interface ProceduralMeleeGuardHolds {
  guard: number;
  move: number;
  run: number;
}

export function resolveProceduralMeleeUpperBodyPose(input: {
  aimPitchRadians: number;
  aimYawRadians: number;
  attackStyle: ProceduralMeleeAttackStyle;
  config: ProceduralMeleeConfig;
  holds: ProceduralMeleeGuardHolds;
  mounted: boolean;
  /** The bearer's seed: it picks the idle state of gear that declares several. */
  seed: number;
  state: ProceduralMeleeAttackState;
}): ProceduralMeleeUpperBodyPose {
  const signals = resolveProceduralMeleeAttackSignals(input.state, input.config);
  const carryWeight = input.mounted ? 0.86 : 0.34;
  // Declared states are shown through the pose filter and in the chest it shows: they lead the attack by the filter's
  // lag, so the figure reaches the contact pose when the contact event fires.
  const leadState = leadProceduralMeleeAttackState(input.state, input.config, PROCEDURAL_POSE_FILTER_LAG_SECONDS);
  const leadSignals = resolveProceduralMeleeAttackSignals(leadState, input.config);
  const weights = resolveDeclaredStateWeights(leadSignals, input.holds, input.seed, input.state);
  const armWeights = { ...weights, guardWeight: leadArmsToGuard(weights.guardWeight) };
  const body = resolveProceduralMeleeWeapon(input.config.weaponId).bodyPoses;
  return {
    ...signals,
    actionWeight: Math.max(signals.actionWeight, carryWeight),
    arms: bowShieldArm(
      resolveDeclaredArms(input.config, (states) => blendProceduralMeleeArmStates(states, armWeights)),
      armWeights.guardWeight,
    ),
    ...(body && { body: blendProceduralMeleeBodyStates(body, weights) }),
    ...(hasDeclaredStates(input.config) && { hit: resolveDeclaredHit(input.config) }),
    aimPitchRadians: input.aimPitchRadians,
    aimYawRadians: input.aimYawRadians,
    attackArcRadians: (input.config.attackArcDegrees * Math.PI) / 180,
    attackStyle: input.attackStyle,
    kind: "melee",
    mounted: input.mounted,
    offhandCarry: resolveProceduralMeleeOffhandCarry(resolveProceduralMeleeOffhand(input.config.offhandId)),
    reach: input.config.reach,
    stepThrough: input.config.stepThrough,
    torsoWeight: input.config.torsoWeight,
    weaponId: input.config.weaponId,
  };
}

/** Moves the declared arms and body towards the gear's hit state by the contact reaction's weight. */
export function applyProceduralMeleeHitReaction(
  pose: ProceduralMeleeUpperBodyPose,
  weight: number,
): ProceduralMeleeUpperBodyPose {
  const { hit } = pose;
  if (!hit || weight <= 1e-4) return pose;
  const armWeight = weight;
  const arm = (side: "left" | "right") => {
    const from = pose.arms[side];
    const to = hit.arms[side];
    return from && to ? lerpProceduralMeleeArmPose(from, to, armWeight) : from;
  };
  return {
    ...pose,
    arms: bowShieldArm({ left: arm("left"), right: arm("right") }, armWeight),
    ...(pose.body && hit.body && { body: stepProceduralMeleeBody(pose.body, hit.body, weight) }),
  };
}

/**
 * The guard is reached by the attack's action weight or a guard held for another reason, whichever is more; the attack's
 * moments by the attack's own weight, so the recover goes back to the guard rather than holding the follow-through.
 */
function resolveDeclaredStateWeights(
  signals: ReturnType<typeof resolveProceduralMeleeAttackSignals>,
  holds: ProceduralMeleeGuardHolds,
  seed: number,
  state: ProceduralMeleeAttackState,
): ProceduralMeleeStateWeights {
  return {
    contact: signals.strikeProgress * signals.actionWeight,
    follow: signals.followThrough * signals.actionWeight,
    guardWeight: Math.max(signals.actionWeight, holds.guard),
    moveHold: holds.move,
    runHold: holds.run,
    seed,
    variant: state.variant,
    windup: signals.windupProgress * signals.actionWeight,
  };
}

/** The shield is on the left arm: its wrist bows out on the way between the idle and the guard or hit (see bowProceduralMeleeArmPose). */
function bowShieldArm(arms: ProceduralMeleeDeclaredArms, weight: number): ProceduralMeleeDeclaredArms {
  return arms.left ? { ...arms, left: bowProceduralMeleeArmPose(arms.left, weight) } : arms;
}

/**
 * The arms go to guard ahead of the feet and leave it after them: raising, the shield is up before the rear knee comes
 * forward; relaxing, it stays up until the feet have stepped back, so the stepping knee never rises into it.
 */
const ARM_LEAD_POWER = 4;

function leadArmsToGuard(guardWeight: number): number {
  return 1 - (1 - guardWeight) ** ARM_LEAD_POWER;
}

function resolveDeclaredArms<T>(
  config: ProceduralMeleeConfig,
  pick: (states: NonNullable<ReturnType<typeof resolveProceduralMeleeWeapon>["armPoses"]>) => T,
): { left?: T; right?: T } {
  const offhandStates = resolveProceduralMeleeOffhand(config.offhandId).armPoses;
  const weaponStates = resolveProceduralMeleeWeapon(config.weaponId).armPoses;
  return {
    ...(offhandStates && { left: pick(offhandStates) }),
    ...(weaponStates && { right: pick(weaponStates) }),
  };
}

function hasDeclaredStates(config: ProceduralMeleeConfig): boolean {
  const weapon = resolveProceduralMeleeWeapon(config.weaponId);
  return Boolean(weapon.armPoses || weapon.bodyPoses || resolveProceduralMeleeOffhand(config.offhandId).armPoses);
}

function resolveDeclaredHit(config: ProceduralMeleeConfig): NonNullable<ProceduralMeleeUpperBodyPose["hit"]> {
  const body = resolveProceduralMeleeWeapon(config.weaponId).bodyPoses?.hit;
  return { arms: resolveDeclaredArms(config, (states) => states.hit), ...(body && { body }) };
}
