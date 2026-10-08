import type { ProceduralMeleeConfig } from "./procedural-melee-config";
import { blendProceduralMeleeArmPoses } from "./procedural-melee-arm-poses";
import { resolveProceduralMeleeAttackSignals, type ProceduralMeleeAttackState } from "./procedural-melee-attack-cycle";
import {
  resolveProceduralMeleeOffhand,
  resolveProceduralMeleeOffhandCarry,
  resolveProceduralMeleeWeapon,
  type ProceduralMeleeArmPose,
  type ProceduralMeleeAttackStyle,
  type ProceduralMeleeOffhandCarry,
  type ProceduralMeleeWeaponId,
} from "./procedural-melee-weapon-catalog";

export interface ProceduralMeleeUpperBodyPose {
  actionWeight: number;
  /**
   * Where the arms of gear that declares arm poses are held, for the moment of the attack, in the chest's own frame. An arm
   * is absent when its gear declares none: the controller then places it with its own targets.
   */
  arms: { left?: ProceduralMeleeArmPose; right?: ProceduralMeleeArmPose };
  aimPitchRadians: number;
  aimYawRadians: number;
  attackArcRadians: number;
  attackStyle: ProceduralMeleeAttackStyle;
  contactProgress: number;
  followThrough: number;
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

export function resolveProceduralMeleeUpperBodyPose(input: {
  aimPitchRadians: number;
  aimYawRadians: number;
  attackStyle: ProceduralMeleeAttackStyle;
  config: ProceduralMeleeConfig;
  mounted: boolean;
  /** Whether the bearer is walking or running on its own legs. */
  moving: boolean;
  state: ProceduralMeleeAttackState;
}): ProceduralMeleeUpperBodyPose {
  const signals = resolveProceduralMeleeAttackSignals(input.state, input.config);
  const carryWeight = input.mounted ? 0.86 : 0.34;
  return {
    ...signals,
    actionWeight: Math.max(signals.actionWeight, carryWeight),
    arms: resolveDeclaredArms(input.config, signals, input.moving),
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

/**
 * The arms of gear that declares arm poses. Standing still they hold `carry` and the attack's own weights move them
 * on. On the move they hold `guard`: `carry` holds the shield low, and a walking or running knee comes up into it.
 */
function resolveDeclaredArms(
  config: ProceduralMeleeConfig,
  signals: ReturnType<typeof resolveProceduralMeleeAttackSignals>,
  moving: boolean,
): ProceduralMeleeUpperBodyPose["arms"] {
  const weights = {
    attackWeight: moving ? 1 : signals.actionWeight,
    followThrough: signals.followThrough,
    strikeProgress: signals.strikeProgress,
    windupProgress: signals.windupProgress,
  };
  const offhandPoses = resolveProceduralMeleeOffhand(config.offhandId).armPoses;
  const weaponPoses = resolveProceduralMeleeWeapon(config.weaponId).armPoses;
  return {
    ...(offhandPoses && { left: blendProceduralMeleeArmPoses(offhandPoses, weights) }),
    ...(weaponPoses && { right: blendProceduralMeleeArmPoses(weaponPoses, weights) }),
  };
}
