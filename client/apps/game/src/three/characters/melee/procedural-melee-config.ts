import type { ProceduralUnitKind } from "../procedural-unit-config";
import {
  resolveDefaultProceduralMeleeLoadout,
  resolveProceduralMeleeOffhand,
  resolveProceduralMeleeWeapon,
  type ProceduralMeleeOffhandId,
  type ProceduralMeleeWeaponId,
} from "./procedural-melee-weapon-catalog";

export interface ProceduralMeleeConfig {
  acquireSeconds: number;
  attackArcDegrees: number;
  autoAttack: boolean;
  contactSeconds: number;
  detailedEquipment: boolean;
  followThroughSeconds: number;
  impactStrength: number;
  offhandId: ProceduralMeleeOffhandId;
  reach: number;
  recoverSeconds: number;
  showArc: boolean;
  showSockets: boolean;
  stepThrough: number;
  strikeSeconds: number;
  targetDistance: number;
  targetHeight: number;
  targetMovement: number;
  targetSpeed: number;
  torsoWeight: number;
  weaponId: ProceduralMeleeWeaponId;
  windupSeconds: number;
}

const DEFAULT_MELEE_CONFIG: ProceduralMeleeConfig = {
  acquireSeconds: 0.12,
  attackArcDegrees: 118,
  autoAttack: false,
  contactSeconds: 0.055,
  detailedEquipment: true,
  followThroughSeconds: 0.24,
  impactStrength: 5,
  offhandId: "round-shield",
  reach: 1.45,
  recoverSeconds: 0.34,
  showArc: true,
  showSockets: false,
  stepThrough: 0.22,
  strikeSeconds: 0.16,
  targetDistance: 1.5,
  targetHeight: 1.02,
  targetMovement: 0,
  targetSpeed: 0.7,
  torsoWeight: 0.62,
  weaponId: "iron-longsword",
  windupSeconds: 0.3,
};

export function createDefaultProceduralMeleeConfig(kind: ProceduralUnitKind = "knight"): ProceduralMeleeConfig {
  return { ...DEFAULT_MELEE_CONFIG, ...resolveDefaultProceduralMeleeLoadout(kind) };
}

export function applyProceduralMeleeConfigPatch(
  current: ProceduralMeleeConfig,
  patch: Partial<ProceduralMeleeConfig>,
): ProceduralMeleeConfig {
  const input = { ...current, ...patch };
  resolveProceduralMeleeWeapon(input.weaponId);
  resolveProceduralMeleeOffhand(input.offhandId);
  return {
    ...input,
    acquireSeconds: clamp(input.acquireSeconds, 0.02, 0.8),
    attackArcDegrees: clamp(input.attackArcDegrees, 35, 220),
    contactSeconds: clamp(input.contactSeconds, 0.02, 0.25),
    followThroughSeconds: clamp(input.followThroughSeconds, 0.05, 1),
    impactStrength: clamp(input.impactStrength, 0, 20),
    reach: clamp(input.reach, 0.6, 3),
    recoverSeconds: clamp(input.recoverSeconds, 0.05, 1.5),
    stepThrough: clamp(input.stepThrough, 0, 0.6),
    strikeSeconds: clamp(input.strikeSeconds, 0.05, 0.6),
    targetDistance: clamp(input.targetDistance, 0.7, 3),
    targetHeight: clamp(input.targetHeight, 0.25, 2.6),
    targetMovement: clamp(input.targetMovement, 0, 1.5),
    targetSpeed: clamp(input.targetSpeed, 0, 3),
    torsoWeight: clamp(input.torsoWeight, 0, 1),
    windupSeconds: clamp(input.windupSeconds, 0.08, 1.2),
  };
}

export function applyDefaultMeleeLoadoutForKind(
  current: ProceduralMeleeConfig,
  kind: ProceduralUnitKind,
): ProceduralMeleeConfig {
  return applyProceduralMeleeConfigPatch(current, resolveDefaultProceduralMeleeLoadout(kind));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
