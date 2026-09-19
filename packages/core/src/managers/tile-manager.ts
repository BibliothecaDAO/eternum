import {
  type GameplayAccount,
  BUILDINGS_CENTER,
  BuildingType,
  Direction,
  HexPosition,
  ID,
  RealmLevels,
  StructureType,
  SystemCalls,
  getDirectionBetweenAdjacentHexes,
  getHexesWithinRadius,
  getNeighborHexes,
  getProducedResource,
} from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { DEFAULT_COORD_ALT, FELT_CENTER, getTileAt } from "..";
import { configManager } from "./config-manager";

const BUILDING_SLOT_COORDINATES = [
  { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] },
  ...getHexesWithinRadius(BUILDINGS_CENTER[0], BUILDINGS_CENTER[1], RealmLevels.Empire + 1),
];
const OCCUPIED_SPACE_REASON = "space is occupied";

const extractErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const isOccupiedSpaceError = (error: unknown): boolean =>
  extractErrorMessage(error).toLowerCase().includes(OCCUPIED_SPACE_REASON);

export class TileManager {
  private col: number;
  private row: number;
  private FELT_CENTER: number;

  constructor(
    private readonly store: NativeFactStore,
    private readonly systemCalls: SystemCalls,
    hexCoords: HexPosition,
    private readonly alt = false,
    private readonly gameId = configManager.getActiveGameId(),
  ) {
    this.col = hexCoords.col;
    this.row = hexCoords.row;
    this.FELT_CENTER = FELT_CENTER();
  }

  /** Bound to where the structure stands, so callers name the structure instead of plumbing its hex. */
  static forStructure(store: NativeFactStore, systemCalls: SystemCalls, structureEntityId: ID): TileManager {
    const structure = store.require("Structure", {
      game_id: configManager.getActiveGameId(),
      entity_id: structureEntityId,
    });
    return new TileManager(
      store,
      systemCalls,
      { col: structure.base.coord_x, row: structure.base.coord_y },
      structure.base.alt,
    );
  }

  getHexCoords = () => {
    return { col: this.col, row: this.row };
  };

  setTile(hexCoords: HexPosition) {
    this.col = hexCoords.col + this.FELT_CENTER;
    this.row = hexCoords.row + this.FELT_CENTER;
  }

  getRealmLevel = (realmEntityId: number): RealmLevels => {
    const structure = this.store.require("Structure", { game_id: this.gameId, entity_id: realmEntityId });
    return (structure?.base.level || RealmLevels.Settlement) as RealmLevels;
  };

  getWonder = (realmEntityId: number) => {
    const structure = this.store.require("Structure", { game_id: this.gameId, entity_id: realmEntityId });
    return structure?.metadata.has_wonder || false;
  };

  existingBuildings = () => {
    const buildings = BUILDING_SLOT_COORDINATES.flatMap(({ col, row }) => {
      const value = this.getBuilding({ col, row });
      if (!value || value.category === BuildingType.None) return [];
      const category = value.category;

      return [
        {
          col: Number(value.inner_col),
          row: Number(value.inner_row),
          category,
          resource: getProducedResource(category),
          paused: value.paused,
          structureType: null,
          pending: false,
        },
      ];
    });

    return buildings;
  };

  getBuilding = (hexCoords: HexPosition) =>
    this.store.get("Building", {
      game_id: this.gameId,
      alt: this.alt,
      outer_col: this.col,
      outer_row: this.row,
      inner_col: hexCoords.col,
      inner_row: hexCoords.row,
    });

  isHexOccupied = (hexCoords: HexPosition) => {
    const building = this.getBuilding(hexCoords);
    return building !== undefined && building.category !== BuildingType.None;
  };

  structureType = () => {
    const tile = getTileAt(this.store, this.alt, this.col, this.row, this.gameId);

    if (tile?.occupier_is_structure) {
      const structure = this.store.get("Structure", { game_id: this.gameId, entity_id: tile.occupier_id });
      if (structure) {
        let category = structure.base.category;
        return category as StructureType;
      }
    }
  };

  placeBuilding = async (
    signer: GameplayAccount,
    structureEntityId: ID,
    buildingType: BuildingType,
    hexCoords: HexPosition,
    useSimpleCost: boolean,
  ) => {
    const { col, row } = hexCoords;
    if (this.isHexOccupied({ col, row })) {
      throw new Error(OCCUPIED_SPACE_REASON);
    }

    const startingPosition: [number, number] = [BUILDINGS_CENTER[0], BUILDINGS_CENTER[1]];
    const endPosition: [number, number] = [col, row];
    const directions = getDirectionsArray(startingPosition, endPosition);
    try {
      return await this.systemCalls.create_building({
        signer,
        entity_id: structureEntityId,
        directions,
        building_category: buildingType,
        use_simple: useSimpleCost,
      });
    } catch (error) {
      console.error(error);
      if (isOccupiedSpaceError(error)) {
        throw new Error(OCCUPIED_SPACE_REASON);
      }
      throw error;
    }
  };

  destroyBuilding = async (signer: GameplayAccount, structureEntityId: ID, col: number, row: number) => {
    await this.systemCalls.destroy_building({
      signer,
      entity_id: structureEntityId,
      building_coord: { alt: DEFAULT_COORD_ALT, x: col, y: row },
    });
  };

  pauseProduction = async (signer: GameplayAccount, structureEntityId: ID, col: number, row: number) => {
    await this.systemCalls.pause_production({
      signer,
      entity_id: structureEntityId,
      building_coord: { alt: DEFAULT_COORD_ALT, x: col, y: row },
    });
  };

  resumeProduction = async (signer: GameplayAccount, structureEntityId: ID, col: number, row: number) => {
    await this.systemCalls.resume_production({
      signer,
      entity_id: structureEntityId,
      building_coord: { alt: DEFAULT_COORD_ALT, x: col, y: row },
    });
  };
}

function getDirectionsArray(start: [number, number], end: [number, number]): Direction[] {
  const [startCol, startRow] = start;
  const [endCol, endRow] = end;

  const queue: { col: number; row: number; path: Direction[] }[] = [{ col: startCol, row: startRow, path: [] }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { col, row, path } = queue.shift()!;

    if (col === endCol && row === endRow) {
      return path;
    }

    const key = `${col},${row}`;
    if (visited.has(key)) continue;
    visited.add(key);

    for (const { col: neighborCol, row: neighborRow } of getNeighborHexes(col, row)) {
      const direction = getDirectionBetweenAdjacentHexes({ col, row }, { col: neighborCol, row: neighborRow });
      if (direction !== null) {
        queue.push({ col: neighborCol, row: neighborRow, path: [...path, direction] });
      }
    }
  }

  return [];
}
