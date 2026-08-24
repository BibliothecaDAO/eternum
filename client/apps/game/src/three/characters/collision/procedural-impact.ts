export type ProceduralImpactAuthority = "debug" | "indexed-replay" | "provisional";
export type ProceduralImpactSource = "arrow" | "body-contact" | "cannonball" | "melee";
export type ProceduralImpactTarget = "mount" | "rider" | "unit";

export interface ProceduralUnitReactionInput {
  directionX: number;
  directionY: number;
  directionZ: number;
  source: ProceduralImpactSource;
  strength: number;
}

export interface ProceduralUnitImpact extends ProceduralUnitReactionInput {
  impactId: string;
  inheritedVelocityX: number;
  inheritedVelocityY: number;
  inheritedVelocityZ: number;
  partId?: string;
  pointX: number;
  pointY: number;
  pointZ: number;
  target: ProceduralImpactTarget;
}

export interface ProceduralCombatImpactRecord extends ProceduralUnitImpact {
  authority: ProceduralImpactAuthority;
  expiresAtSeconds: number;
  targetEntityId: number;
}

export function normalizeProceduralReaction(input: ProceduralUnitReactionInput): ProceduralUnitReactionInput {
  const length = Math.hypot(input.directionX, input.directionY, input.directionZ);
  const inverseLength = length > 1e-8 ? 1 / length : 0;
  return {
    directionX: length > 1e-8 ? input.directionX * inverseLength : 0,
    directionY: length > 1e-8 ? input.directionY * inverseLength : 0,
    directionZ: length > 1e-8 ? input.directionZ * inverseLength : 1,
    source: input.source,
    strength: normalizeStrength(input.strength),
  };
}

export function normalizeProceduralImpact(input: ProceduralUnitImpact): ProceduralUnitImpact {
  const reaction = normalizeProceduralReaction(input);
  return {
    ...input,
    ...reaction,
    impactId: String(input.impactId),
    inheritedVelocityX: finiteOrZero(input.inheritedVelocityX),
    inheritedVelocityY: finiteOrZero(input.inheritedVelocityY),
    inheritedVelocityZ: finiteOrZero(input.inheritedVelocityZ),
    pointX: finiteOrZero(input.pointX),
    pointY: finiteOrZero(input.pointY),
    pointZ: finiteOrZero(input.pointZ),
  };
}

function normalizeStrength(value: number): number {
  return Number.isFinite(value) ? Math.min(40, Math.max(0, value)) : 0;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
