import { RealmLevels, StructureType } from "@bibliothecadao/types/terrain";

import type { TerrainSettlementAnchor } from "./terrain-types";

export interface TerrainSettlementInfluenceProfile {
  disturbanceStrength: number;
  radiusScale: number;
}

export const MAX_TERRAIN_SETTLEMENT_INFLUENCE_RADIUS = 2.7;

type StructureInfluence = TerrainSettlementInfluenceProfile & { levelDisturbance: number; levelRadius: number };

const MINE_INFLUENCE: StructureInfluence = {
  disturbanceStrength: 0.92,
  levelDisturbance: 0.06,
  levelRadius: 0.12,
  radiusScale: 1.04,
};
const CAMP_INFLUENCE: StructureInfluence = {
  disturbanceStrength: 0.82,
  levelDisturbance: 0.08,
  levelRadius: 0.08,
  radiusScale: 0.88,
};

// Every structure category has a footprint: a category added to the contract fails typecheck here until it has one.
const STRUCTURE_INFLUENCE: Record<StructureType, StructureInfluence> = {
  [StructureType.Realm]: { disturbanceStrength: 0.78, levelDisturbance: 0.18, levelRadius: 0.24, radiusScale: 1 },
  [StructureType.Hyperstructure]: { disturbanceStrength: 1, levelDisturbance: 0, levelRadius: 0.08, radiusScale: 1.4 },
  [StructureType.Bank]: { disturbanceStrength: 0.72, levelDisturbance: 0.08, levelRadius: 0.08, radiusScale: 0.86 },
  [StructureType.Mine]: MINE_INFLUENCE,
  [StructureType.BitcoinMine]: MINE_INFLUENCE,
  [StructureType.Village]: { disturbanceStrength: 0.62, levelDisturbance: 0.12, levelRadius: 0.12, radiusScale: 0.78 },
  [StructureType.Camp]: CAMP_INFLUENCE,
  // Frontier's sites: a rift tears the ground as a mine does, a ruin keeps a fallen realm's footprint without growing
  // with a level, and beasts stand as a camp.
  [StructureType.Rift]: MINE_INFLUENCE,
  [StructureType.Ruin]: { disturbanceStrength: 0.78, levelDisturbance: 0, levelRadius: 0, radiusScale: 1 },
  [StructureType.Beasts]: CAMP_INFLUENCE,
};

export function resolveTerrainSettlementInfluence(anchor: TerrainSettlementAnchor): TerrainSettlementInfluenceProfile {
  const level = requireSettlementLevel(anchor.level);
  const levelProgress = Math.min(RealmLevels.Empire, level) / RealmLevels.Empire;
  const base = requireStructureInfluence(anchor.structureType);
  return {
    disturbanceStrength: clampUnit(base.disturbanceStrength + levelProgress * base.levelDisturbance),
    radiusScale: Math.min(1.42, base.radiusScale + levelProgress * base.levelRadius),
  };
}

const reportedUnplaceableSettlements = new Set<string>();

/**
 * A settlement's influence on the page being built, or null for one this build cannot place: a category the chain
 * sends that the client does not know yet, or a level outside RealmLevels. Such a settlement costs only its own
 * footprint. It is reported once, loudly, and the ground under it draws undisturbed, so one row never fails a page's
 * terrain or the map's setup.
 */
export function resolvePlaceableTerrainSettlementInfluence(
  anchor: TerrainSettlementAnchor,
): TerrainSettlementInfluenceProfile | null {
  try {
    return resolveTerrainSettlementInfluence(anchor);
  } catch (error) {
    reportUnplaceableSettlement(anchor, error);
    return null;
  }
}

function reportUnplaceableSettlement(anchor: TerrainSettlementAnchor, error: unknown): void {
  const kind = `${String(anchor.structureType)}:${String(anchor.level)}`;
  if (reportedUnplaceableSettlements.has(kind)) return;
  reportedUnplaceableSettlements.add(kind);
  console.error(
    `[Terrain] Structure ${anchor.structureId} at (${anchor.col}, ${anchor.row}) draws without its settlement footprint`,
    error,
  );
}

// The category is a chain fact, so a build older than the contract can meet one outside its enum at runtime.
function requireStructureInfluence(structureType: StructureType): StructureInfluence {
  const influence: StructureInfluence | undefined = STRUCTURE_INFLUENCE[structureType];
  if (!influence) throw new Error(`Unsupported terrain settlement structure type: ${String(structureType)}`);
  return influence;
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
