import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { configManager, getExplorerOwner, Position } from "@bibliothecadao/eternum";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import type { HexEntityInfo } from "@bibliothecadao/types";
import { BiomeType, ETHEREAL_STRIDE, TileOccupier } from "@bibliothecadao/types";
import type { ExplorationMapSnapshot } from "./types";

const setNestedValue = <T>(map: Map<number, Map<number, T>>, col: number, row: number, value: T) => {
  const column = map.get(col) ?? new Map<number, T>();
  column.set(row, value);
  map.set(col, column);
};

const getStructureOwnerAddress = (store: NativeFactStore, structureId: number): bigint =>
  store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: structureId })?.owner ?? 0n;

const getArmyOwnerAddress = (store: NativeFactStore, armyId: number): bigint => {
  const explorer = store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: armyId });
  return explorer ? getExplorerOwner(store, explorer) : 0n;
};

const buildHexInfo = (id: number, owner: bigint): HexEntityInfo => ({ id, owner });

type SnapshotParams = {
  store: NativeFactStore;
  explorerId: number;
  scopeRadius: number;
  worldSpatialProjection: WorldSpatialProjection;
};

export const buildExplorationSnapshot = async ({
  store,
  explorerId,
  scopeRadius,
  worldSpatialProjection,
}: SnapshotParams): Promise<ExplorationMapSnapshot | null> => {
  const explorer = store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: explorerId });
  if (!explorer?.coord) return null;

  const centerCol = Number(explorer.coord.x);
  const centerRow = Number(explorer.coord.y);
  const alt = explorer.coord.alt;
  const radius = Math.max(1, Math.round(scopeRadius)) * (alt ? ETHEREAL_STRIDE : 1);
  const bounds = {
    minCol: centerCol - radius,
    maxCol: centerCol + radius,
    minRow: centerRow - radius,
    maxRow: centerRow + radius,
  };

  const exploredTiles = new Map<number, Map<number, BiomeType>>();
  const structureHexes = new Map<number, Map<number, HexEntityInfo>>();
  const armyHexes = new Map<number, Map<number, HexEntityInfo>>();
  const chestHexes = new Map<number, Map<number, HexEntityInfo>>();

  const layerBounds = { ...bounds, alt };
  worldSpatialProjection.getTilesInBounds(layerBounds).forEach((tile) => {
    const normalized = new Position({ x: tile.hexCoords.col, y: tile.hexCoords.row }).getNormalized();
    if (tile.biome !== 0) {
      setNestedValue(exploredTiles, normalized.x, normalized.y, tile.biome as unknown as BiomeType);
    }
    if (tile.occupierId === 0 || tile.occupierType === TileOccupier.None) return;

    const info = buildHexInfo(Number(tile.occupierId), 0n);
    if (tile.occupierType === TileOccupier.Chest) {
      setNestedValue(chestHexes, normalized.x, normalized.y, info);
    }
  });

  worldSpatialProjection.getStructuresInBounds(layerBounds).forEach((structure) => {
    if (structure.entityId === null) return;
    const normalized = new Position({ x: structure.hexCoords.col, y: structure.hexCoords.row }).getNormalized();
    setNestedValue(
      structureHexes,
      normalized.x,
      normalized.y,
      buildHexInfo(Number(structure.entityId), getStructureOwnerAddress(store, Number(structure.entityId))),
    );
  });

  worldSpatialProjection.getArmiesInBounds(layerBounds).forEach((army) => {
    const normalized = new Position({ x: army.hexCoords.col, y: army.hexCoords.row }).getNormalized();
    setNestedValue(
      armyHexes,
      normalized.x,
      normalized.y,
      buildHexInfo(Number(army.entityId), getArmyOwnerAddress(store, Number(army.entityId))),
    );
  });

  return {
    alt,
    position: { col: centerCol, row: centerRow },
    exploredTiles,
    structureHexes,
    armyHexes,
    chestHexes,
  };
};
