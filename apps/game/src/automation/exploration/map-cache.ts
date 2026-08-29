import { gameEntityKey } from "@/sync/game-scope";
import { Position } from "@bibliothecadao/eternum";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import type { ClientComponents, HexEntityInfo } from "@bibliothecadao/types";
import { BiomeType, TileOccupier } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import type { ExplorationMapSnapshot } from "./types";

const setNestedValue = <T>(map: Map<number, Map<number, T>>, col: number, row: number, value: T) => {
  const column = map.get(col) ?? new Map<number, T>();
  column.set(row, value);
  map.set(col, column);
};

const normalizeOwnerAddress = (value: unknown): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value) && value !== 0) return BigInt(value);
  if (typeof value !== "string" || value.length === 0) return 0n;

  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const getStructureOwnerAddress = (components: ClientComponents, structureId: number): bigint => {
  const structure = getComponentValue(components.Structure, gameEntityKey([BigInt(structureId)]));
  return normalizeOwnerAddress(structure?.owner);
};

const getArmyOwnerAddress = (components: ClientComponents, armyId: number): bigint => {
  const explorer = getComponentValue(components.ExplorerTroops, gameEntityKey([BigInt(armyId)]));
  const ownerStructureId = Number(explorer?.owner ?? 0);
  return Number.isFinite(ownerStructureId) && ownerStructureId !== 0
    ? getStructureOwnerAddress(components, ownerStructureId)
    : 0n;
};

const buildHexInfo = (id: number, owner: bigint): HexEntityInfo => ({ id, owner });

type SnapshotParams = {
  components: ClientComponents;
  explorerId: number;
  scopeRadius: number;
  worldSpatialProjection: WorldSpatialProjection;
};

export const buildExplorationSnapshot = async ({
  components,
  explorerId,
  scopeRadius,
  worldSpatialProjection,
}: SnapshotParams): Promise<ExplorationMapSnapshot | null> => {
  const explorer = getComponentValue(components.ExplorerTroops, gameEntityKey([BigInt(explorerId)]));
  if (!explorer?.coord) return null;

  const centerCol = Number(explorer.coord.x);
  const centerRow = Number(explorer.coord.y);
  const radius = Math.max(1, Math.round(scopeRadius));
  const bounds = {
    minCol: centerCol - radius,
    maxCol: centerCol + radius,
    minRow: centerRow - radius,
    maxRow: centerRow + radius,
  };

  const exploredTiles = new Map<number, Map<number, BiomeType>>();
  const structureHexes = new Map<number, Map<number, HexEntityInfo>>();
  const armyHexes = new Map<number, Map<number, HexEntityInfo>>();
  const questHexes = new Map<number, Map<number, HexEntityInfo>>();
  const chestHexes = new Map<number, Map<number, HexEntityInfo>>();

  worldSpatialProjection.getTilesInBounds(bounds).forEach((tile) => {
    const normalized = new Position({ x: tile.hexCoords.col, y: tile.hexCoords.row }).getNormalized();
    if (tile.biome !== 0) {
      setNestedValue(exploredTiles, normalized.x, normalized.y, tile.biome as unknown as BiomeType);
    }
    if (tile.occupierId === 0 || tile.occupierType === TileOccupier.None) return;

    const info = buildHexInfo(Number(tile.occupierId), 0n);
    if (tile.occupierType === TileOccupier.Quest) {
      setNestedValue(questHexes, normalized.x, normalized.y, info);
    } else if (tile.occupierType === TileOccupier.Chest) {
      setNestedValue(chestHexes, normalized.x, normalized.y, info);
    }
  });

  worldSpatialProjection.getStructuresInBounds(bounds).forEach((structure) => {
    if (structure.entityId === null) return;
    const normalized = new Position({ x: structure.hexCoords.col, y: structure.hexCoords.row }).getNormalized();
    setNestedValue(
      structureHexes,
      normalized.x,
      normalized.y,
      buildHexInfo(Number(structure.entityId), getStructureOwnerAddress(components, Number(structure.entityId))),
    );
  });

  worldSpatialProjection.getArmiesInBounds(bounds).forEach((army) => {
    const normalized = new Position({ x: army.hexCoords.col, y: army.hexCoords.row }).getNormalized();
    setNestedValue(
      armyHexes,
      normalized.x,
      normalized.y,
      buildHexInfo(Number(army.entityId), getArmyOwnerAddress(components, Number(army.entityId))),
    );
  });

  return {
    position: { col: centerCol, row: centerRow },
    exploredTiles,
    structureHexes,
    armyHexes,
    questHexes,
    chestHexes,
  };
};
