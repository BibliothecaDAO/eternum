import type { ProceduralMeleeConfig } from "./procedural-melee-config";
import { resolveProceduralMeleeAttackSignals, type ProceduralMeleeAttackState } from "./procedural-melee-attack-cycle";
import type {
  ProceduralMeleeAttackStyle,
  ProceduralMeleeOffhandId,
  ProceduralMeleeWeaponId,
} from "./procedural-melee-weapon-catalog";

export interface ProceduralMeleeUpperBodyPose {
  actionWeight: number;
  aimPitchRadians: number;
  aimYawRadians: number;
  attackArcRadians: number;
  attackStyle: ProceduralMeleeAttackStyle;
  contactProgress: number;
  followThrough: number;
  kind: "melee";
  mounted: boolean;
  offhandId: ProceduralMeleeOffhandId;
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
  state: ProceduralMeleeAttackState;
}): ProceduralMeleeUpperBodyPose {
  const signals = resolveProceduralMeleeAttackSignals(input.state, input.config);
  const carryWeight = input.mounted ? 0.86 : 0.34;
  return {
    ...signals,
    actionWeight: Math.max(signals.actionWeight, carryWeight),
    aimPitchRadians: input.aimPitchRadians,
    aimYawRadians: input.aimYawRadians,
    attackArcRadians: (input.config.attackArcDegrees * Math.PI) / 180,
    attackStyle: input.attackStyle,
    kind: "melee",
    mounted: input.mounted,
    offhandId: input.config.offhandId,
    reach: input.config.reach,
    stepThrough: input.config.stepThrough,
    torsoWeight: input.config.torsoWeight,
    weaponId: input.config.weaponId,
  };
}
