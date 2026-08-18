import {
  type DojoAccount,
  BUILDINGS_CENTER,
  BuildingType,
  ClientComponents,
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
import { getComponentValue } from "@dojoengine/recs";
import {
  DEFAULT_COORD_ALT,
  FELT_CENTER,
  ResourceManager,
  getBuildingCosts,
  getBuildingCount,
  getTileAt,
  setBuildingCount,
} from "..";
import {
  getActiveGameSyncRuntime,
  trackProvisionalTransaction,
  type GameSyncProvisionalWrite,
  type ProvisionalIntent,
} from "../sync";
import { configManager, buildingEntityKey, gameEntityKey } from "./config-manager";
import { getGameEntityKeyGameId } from "./game-entity-keys";

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
    private readonly components: ClientComponents,
    private readonly systemCalls: SystemCalls,
    hexCoords: HexPosition,
  ) {
    this.col = hexCoords.col;
    this.row = hexCoords.row;
    this.FELT_CENTER = FELT_CENTER();
  }

  getHexCoords = () => {
    return { col: this.col, row: this.row };
  };

  setTile(hexCoords: HexPosition) {
    this.col = hexCoords.col + this.FELT_CENTER;
    this.row = hexCoords.row + this.FELT_CENTER;
  }

  getRealmLevel = (realmEntityId: number): RealmLevels => {
    const structure = getComponentValue(this.components.Structure, gameEntityKey([BigInt(realmEntityId)]));
    return (structure?.base.level || RealmLevels.Settlement) as RealmLevels;
  };

  getWonder = (realmEntityId: number) => {
    const structure = getComponentValue(this.components.Structure, gameEntityKey([BigInt(realmEntityId)]));
    return structure?.metadata.has_wonder || false;
  };

  existingBuildings = () => {
    // Read every bounded local slot through the overridable component. Indexed
    // HasValue queries can omit override-only entities, while scanning the
    // whole streamed world component makes local redraw cost grow with the map.
    const runtime = getActiveGameSyncRuntime();
    const buildings = BUILDING_SLOT_COORDINATES.flatMap(({ col, row }) => {
      const entity = buildingEntityKey(this.col, this.row, col, row);
      const value = getComponentValue(this.components.Building, entity);
      if (
        value == null ||
        value.outer_col !== this.col ||
        value.outer_row !== this.row ||
        value.entity_id === 0 ||
        value.category === BuildingType.None
      ) {
        return [];
      }
      const category = value.category;

      return [
        {
          col: Number(value.inner_col),
          row: Number(value.inner_row),
          category,
          resource: getProducedResource(category),
          paused: value.paused,
          structureType: null,
          // Row exists only as a provisional overlay — a placement whose tx has
          // not echoed back yet. Renderers show it disabled; occupancy already
          // counts it, which is what blocks double-submits on the same slot.
          pending: runtime?.isProvisionalOnly("Building", entity) ?? false,
        },
      ];
    });

    return buildings;
  };

  getBuilding = (hexCoords: HexPosition) => {
    const building = getComponentValue(
      this.components.Building,
      buildingEntityKey(this.col, this.row, hexCoords.col, hexCoords.row),
    );
    return building;
  };

  isHexOccupied = (hexCoords: HexPosition) => {
    const { col, row } = hexCoords;
    const building = getComponentValue(this.components.Building, buildingEntityKey(this.col, this.row, col, row));
    return building !== undefined && building.category !== BuildingType.None;
  };

  structureType = () => {
    const tile = getTileAt(this.components, DEFAULT_COORD_ALT, this.col, this.row);

    if (tile?.occupier_is_structure) {
      const structure = getComponentValue(this.components.Structure, gameEntityKey([BigInt(tile?.occupier_id)]));
      if (structure) {
        let category = structure.base.category;
        return category as StructureType;
      }
    }
  };

  private getBonusFromNeighborBuildings = (col: number, row: number) => {
    const neighborBuildingCoords = getNeighborHexes(col, row);

    let bonusPercent = 0;
    neighborBuildingCoords.map((coord) => {
      const building = getComponentValue(
        this.components.Building,
        buildingEntityKey(this.col, this.row, coord.col, coord.row),
      );

      if (building?.category === BuildingType.ResourceWheat) bonusPercent += building.bonus_percent;
    });

    return bonusPercent;
  };

  private createBuildingProvisionalWrites = (
    entityId: ID,
    col: number,
    row: number,
    buildingType: BuildingType,
    useSimpleCost: boolean,
  ): GameSyncProvisionalWrite[] => {
    const buildingEntity = buildingEntityKey(this.col, this.row, col, row);
    const resourceChange = getBuildingCosts(entityId, this.components, buildingType, useSimpleCost);
    const realmEntity = gameEntityKey([BigInt(entityId)]);
    const structureBuildings = getComponentValue(this.components.StructureBuildings, realmEntity);
    const buildingCount = getBuildingCount(buildingType, [
      structureBuildings?.packed_counts_1 || 0n,
      structureBuildings?.packed_counts_2 || 0n,
      structureBuildings?.packed_counts_3 || 0n,
    ]);

    // Ensure array has values at all indices up to buildingType
    const packedBuildingCount = setBuildingCount(
      buildingType,
      [
        structureBuildings?.packed_counts_1 || 0n,
        structureBuildings?.packed_counts_2 || 0n,
        structureBuildings?.packed_counts_3 || 0n,
      ],
      buildingCount + 1,
    );
    const buildingConfig = configManager.getBuildingCategoryConfig(buildingType);
    // The patch must carry EVERY schema field (including the key-derived
    // game_id/alt): RECS returns undefined for an override-only row missing any
    // non-optional field, which would make the pending building invisible to
    // every read. entity_id is a placeholder — Cairo assigns a fresh uuid().
    const buildingPatch = {
      game_id: getGameEntityKeyGameId(),
      alt: false,
      outer_col: this.col,
      outer_row: this.row,
      inner_col: col,
      inner_row: row,
      category: buildingType,
      bonus_percent: this.getBonusFromNeighborBuildings(col, row),
      entity_id: entityId,
      outer_entity_id: entityId,
      paused: false,
    };
    const writes: GameSyncProvisionalWrite[] = [
      {
        entityId: buildingEntity,
        model: "Building",
        patch: buildingPatch,
        // Match only what Cairo deterministically echoes: the row identity and
        // category. entity_id (fresh uuid) and bonus_percent (never written by
        // the contract) would make the intent permanently unreconcilable.
        matchPatch: {
          outer_col: this.col,
          outer_row: this.row,
          inner_col: col,
          inner_row: row,
          category: buildingType,
        },
      },
      {
        entityId: realmEntity,
        model: "StructureBuildings",
        patch: {
          packed_counts_1: packedBuildingCount[0],
          packed_counts_2: packedBuildingCount[1],
          packed_counts_3: packedBuildingCount[2],
          population: {
            current: (structureBuildings?.population.current || 0) + (buildingConfig?.population_cost ?? 0),
            max: (structureBuildings?.population.max || 0) + (buildingConfig?.capacity_grant ?? 0),
          },
        },
        matchPatch: {
          packed_counts_1: packedBuildingCount[0],
          packed_counts_2: packedBuildingCount[1],
          packed_counts_3: packedBuildingCount[2],
        },
      },
    ];
    const resourcePatch = new ResourceManager(this.components, entityId).resolveOptimisticResourceChangesPatch(
      (resourceChange ?? []).map(({ resource, amount }) => ({ resourceId: resource, amount: -amount })),
    );
    if (resourcePatch) {
      writes.push({ entityId: realmEntity, model: "Resource", patch: resourcePatch, matchPatch: undefined });
    }
    return writes;
  };

  private createDestroyProvisionalWrites = (entityId: ID, col: number, row: number): GameSyncProvisionalWrite[] => {
    const realmBase = getComponentValue(this.components.Structure, gameEntityKey([BigInt(entityId)]))?.base;
    const { coord_x: outercol, coord_y: outerrow } = realmBase || { coord_x: 0, coord_y: 0 };
    // Building is keyed (game_id, alt, outer, outer, inner, inner) — the plain
    // gameEntityKey misses the alt key and would target a nonexistent row.
    const entity = buildingEntityKey(outercol, outerrow, col, row);
    const currentBuilding = getComponentValue(this.components.Building, entity);
    if (!currentBuilding) throw new Error(`Cannot destroy missing building at ${col},${row}`);
    const type = currentBuilding.category as BuildingType;
    const realmEntityId = gameEntityKey([BigInt(entityId)]);
    const currentStructureBuildings = getComponentValue(this.components.StructureBuildings, realmEntityId);
    const buildingCount = getBuildingCount(type, [
      currentStructureBuildings?.packed_counts_1 || 0n,
      currentStructureBuildings?.packed_counts_2 || 0n,
      currentStructureBuildings?.packed_counts_3 || 0n,
    ]);

    const newCount = buildingCount > 0 ? buildingCount - 1 : 0;
    const packedBuildingCount = setBuildingCount(
      type,
      [
        currentStructureBuildings?.packed_counts_1 || 0n,
        currentStructureBuildings?.packed_counts_2 || 0n,
        currentStructureBuildings?.packed_counts_3 || 0n,
      ],
      newCount,
    );
    const buildingConfig = configManager.getBuildingCategoryConfig(type);
    const buildingPatch = {
      game_id: getGameEntityKeyGameId(),
      alt: false,
      outer_col: outercol,
      outer_row: outerrow,
      inner_col: col,
      inner_row: row,
      category: BuildingType.None,
      bonus_percent: 0,
      entity_id: 0,
      outer_entity_id: 0,
      paused: false,
    };
    return [
      {
        entityId: entity,
        model: "Building",
        patch: buildingPatch,
        // Cairo erases the row; the echo is a deletion, which `null` matches.
        matchPatch: null,
      },
      {
        entityId: realmEntityId,
        model: "StructureBuildings",
        patch: {
          packed_counts_1: packedBuildingCount[0],
          packed_counts_2: packedBuildingCount[1],
          packed_counts_3: packedBuildingCount[2],
          population: {
            current: (currentStructureBuildings?.population.current || 0) - buildingConfig.population_cost,
            max: (currentStructureBuildings?.population.max || 0) - buildingConfig.capacity_grant,
          },
        },
        matchPatch: {
          packed_counts_1: packedBuildingCount[0],
          packed_counts_2: packedBuildingCount[1],
          packed_counts_3: packedBuildingCount[2],
        },
      },
    ];
  };

  private createProductionProvisionalWrite = (col: number, row: number, paused: boolean): GameSyncProvisionalWrite => {
    const entity = buildingEntityKey(this.col, this.row, col, row);
    const building = getComponentValue(this.components.Building, entity);
    if (!building) throw new Error(`Cannot update missing building at ${col},${row}`);
    return { entityId: entity, model: "Building", patch: { paused }, matchPatch: { paused } };
  };

  private createProvisionalIntent = (writes: readonly GameSyncProvisionalWrite[]): ProvisionalIntent | null => {
    return getActiveGameSyncRuntime()?.createProvisionalIntent(writes) ?? null;
  };

  private trackTransaction = (
    intent: ProvisionalIntent | null,
    signer: DojoAccount,
    transactionResult: unknown,
  ): void => {
    if (intent) trackProvisionalTransaction(intent, signer, transactionResult);
  };

  placeBuilding = async (
    signer: DojoAccount,
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
    const intent = this.createProvisionalIntent(
      this.createBuildingProvisionalWrites(structureEntityId, col, row, buildingType, useSimpleCost),
    );

    try {
      const result = await this.systemCalls.create_building({
        signer,
        entity_id: structureEntityId,
        directions: directions,
        building_category: buildingType,
        use_simple: useSimpleCost,
      });
      this.trackTransaction(intent, signer, result);
      return result;
    } catch (error) {
      intent?.fail();
      console.error(error);
      if (isOccupiedSpaceError(error)) {
        throw new Error(OCCUPIED_SPACE_REASON);
      }
      throw error;
    }
  };

  destroyBuilding = async (signer: DojoAccount, structureEntityId: ID, col: number, row: number) => {
    const intent = this.createProvisionalIntent(this.createDestroyProvisionalWrites(structureEntityId, col, row));

    try {
      const result = await this.systemCalls.destroy_building({
        signer,
        entity_id: structureEntityId,
        building_coord: {
          alt: DEFAULT_COORD_ALT,
          x: col,
          y: row,
        },
      });
      this.trackTransaction(intent, signer, result);
    } catch (error) {
      intent?.fail();
      throw error;
    }
  };

  pauseProduction = async (signer: DojoAccount, structureEntityId: ID, col: number, row: number) => {
    const intent = this.createProvisionalIntent([this.createProductionProvisionalWrite(col, row, true)]);

    try {
      const result = await this.systemCalls.pause_production({
        signer,
        entity_id: structureEntityId,
        building_coord: {
          alt: DEFAULT_COORD_ALT,
          x: col,
          y: row,
        },
      });
      this.trackTransaction(intent, signer, result);
    } catch (error) {
      intent?.fail();
      console.error(error);
      throw error;
    }
  };

  resumeProduction = async (signer: DojoAccount, structureEntityId: ID, col: number, row: number) => {
    const intent = this.createProvisionalIntent([this.createProductionProvisionalWrite(col, row, false)]);

    try {
      const result = await this.systemCalls.resume_production({
        signer,
        entity_id: structureEntityId,
        building_coord: {
          alt: DEFAULT_COORD_ALT,
          x: col,
          y: row,
        },
      });
      this.trackTransaction(intent, signer, result);
    } catch (error) {
      intent?.fail();
      console.error(error);
      throw error;
    }
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
