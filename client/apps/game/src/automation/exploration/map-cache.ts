import { getMapFromToriiExact } from "@/dojo/queries";
import { DEFAULT_COORD_ALT, Position, getTileAt, isTileOccupierChest, isTileOccupierQuest, isTileOccupierStructure } from "@bibliothecadao/eternum";
import type { ClientComponents, HexEntityInfo, TileOccupier } from "@bibliothecadao/types";
import { BiomeType } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import type { ToriiClient } from "@dojoengine/torii-client";
import type { ExplorationMapSnapshot } from "./types";

const setNestedValue = <T>(map: Map<number, Map<number, T>>, col: number, row: number, value: T) => {
  if (!map.has(col)) {
    map.set(col, new Map());
  }
  map.get(col)!.set(row, value);
};

const buildHexInfo = (id: number): HexEntityInfo => ({ id, owner: 0n });

type SnapshotParams = {
  components: ClientComponents;
  contractComponents: any;
  toriiClient: ToriiClient;
  explorerId: number;
  scopeRadius: number;
};

export const buildExplorationSnapshot = async ({
  components,
  contractComponents,
  toriiClient,
  explorerId,
  scopeRadius,
}: SnapshotParams): Promise<ExplorationMapSnapshot | null> => {
  const explorerEntity = getEntityIdFromKeys([BigInt(explorerId)]);
  const explorer = getComponentValue(components.ExplorerTroops, explorerEntity);
  if (!explorer?.coord) {
    return null;
  }

  const centerCol = Number(explorer.coord.x);
  const centerRow = Number(explorer.coord.y);
  const radius = Math.max(1, Math.round(scopeRadius));

  const minCol = centerCol - radius;
  const maxCol = centerCol + radius;
  const minRow = centerRow - radius;
  const maxRow = centerRow + radius;

  await getMapFromToriiExact(toriiClient, contractComponents as any, minCol, maxCol, minRow, maxRow);

  const exploredTiles = new Map<number, Map<number, BiomeType>>();
  const structureHexes = new Map<number, Map<number, HexEntityInfo>>();
  const armyHexes = new Map<number, Map<number, HexEntityInfo>>();
  const questHexes = new Map<number, Map<number, HexEntityInfo>>();
  const chestHexes = new Map<number, Map<number, HexEntityInfo>>();

  for (let col = minCol; col <= maxCol; col += 1) {
    for (let row = minRow; row <= maxRow; row += 1) {
      const tile = getTileAt(components, DEFAULT_COORD_ALT, col, row);
      if (!tile) continue;

      const normalized = new Position({ x: col, y: row }).getNormalized();

      if (tile.biome !== 0) {
        const biome = tile.biome as unknown as BiomeType;
        setNestedValue(exploredTiles, normalized.x, normalized.y, biome);
      }

      if (tile.occupier_id && tile.occupier_id !== 0) {
        const info = buildHexInfo(tile.occupier_id);
        const occupierType = tile.occupier_type as TileOccupier;
        if (isTileOccupierQuest(occupierType)) {
          setNestedValue(questHexes, normalized.x, normalized.y, info);
        } else if (isTileOccupierChest(occupierType)) {
          setNestedValue(chestHexes, normalized.x, normalized.y, info);
        } else if (isTileOccupierStructure(occupierType)) {
          setNestedValue(structureHexes, normalized.x, normalized.y, info);
        } else {
          setNestedValue(armyHexes, normalized.x, normalized.y, info);
        }
      }
    }
  }

  return {
    position: { col: centerCol, row: centerRow },
    exploredTiles,
    structureHexes,
    armyHexes,
    questHexes,
    chestHexes,
  };
};
