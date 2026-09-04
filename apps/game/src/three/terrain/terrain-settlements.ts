import { RealmLevels, StructureType } from "@bibliothecadao/types";

import type { TerrainSettlementAnchor } from "./terrain-types";

export interface TerrainSettlementInfluenceProfile {
  disturbanceStrength: number;
  radiusScale: number;
}

export const MAX_TERRAIN_SETTLEMENT_INFLUENCE_RADIUS = 2.7;

export function resolveTerrainSettlementInfluence(anchor: TerrainSettlementAnchor): TerrainSettlementInfluenceProfile {
  const level = requireSettlementLevel(anchor.level);
  const levelProgress = Math.min(RealmLevels.Empire, level) / RealmLevels.Empire;
  const base = resolveStructureInfluence(anchor.structureType);
  return {
    disturbanceStrength: clampUnit(base.disturbanceStrength + levelProgress * base.levelDisturbance),
    radiusScale: Math.min(1.42, base.radiusScale + levelProgress * base.levelRadius),
  };
}

function resolveStructureInfluence(structureType: StructureType): TerrainSettlementInfluenceProfile & {
  levelDisturbance: number;
  levelRadius: number;
} {
  switch (structureType) {
    case StructureType.Realm:
      return { disturbanceStrength: 0.78, levelDisturbance: 0.18, levelRadius: 0.24, radiusScale: 1 };
    case StructureType.Hyperstructure:
      return { disturbanceStrength: 1, levelDisturbance: 0, levelRadius: 0.08, radiusScale: 1.4 };
    case StructureType.Bank:
      return { disturbanceStrength: 0.72, levelDisturbance: 0.08, levelRadius: 0.08, radiusScale: 0.86 };
    case StructureType.FragmentMine:
    case StructureType.BitcoinMine:
      return { disturbanceStrength: 0.92, levelDisturbance: 0.06, levelRadius: 0.12, radiusScale: 1.04 };
    case StructureType.Village:
      return { disturbanceStrength: 0.62, levelDisturbance: 0.12, levelRadius: 0.12, radiusScale: 0.78 };
    case StructureType.HolySite:
      return { disturbanceStrength: 0.58, levelDisturbance: 0.08, levelRadius: 0.1, radiusScale: 0.9 };
    case StructureType.Camp:
      return { disturbanceStrength: 0.82, levelDisturbance: 0.08, levelRadius: 0.08, radiusScale: 0.88 };
    default:
      throw new Error(`Unsupported terrain settlement structure type: ${String(structureType)}`);
  }
}

// Structure.base.level is the 0-based RealmLevels enum: every fresh realm is a Settlement at 0.
function requireSettlementLevel(level: number): number {
  if (!Number.isInteger(level) || level < RealmLevels.Settlement) {
    throw new Error(`Terrain settlement level must be a RealmLevels value, received ${String(level)}`);
  }
  return level;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
