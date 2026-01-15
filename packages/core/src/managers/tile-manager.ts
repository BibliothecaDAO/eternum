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
  getNeighborHexes,
  getProducedResource,
} from "@bibliothecadao/types";
import { Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import {
  FELT_CENTER,
  ResourceManager,
  getBuildingCosts,
  getBuildingCount,
  setBuildingCount,
  getTileAt,
  DEFAULT_COORD_ALT,
} from "..";
import { configManager } from "./config-manager";

// Module-level Set to track pending builds across TileManager instances
// This prevents race conditions between optimistic updates and Torii sync
const pendingBuilds = new Set<string>();

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
    const structure = getComponentValue(this.components.Structure, getEntityIdFromKeys([BigInt(realmEntityId)]));
    return (structure?.base.level || RealmLevels.Settlement) as RealmLevels;
  };

  getWonder = (realmEntityId: number) => {
    const structure = getComponentValue(this.components.Structure, getEntityIdFromKeys([BigInt(realmEntityId)]));
    return structure?.metadata.has_wonder || false;
  };

  existingBuildings = () => {
    const builtBuildings = Array.from(
      runQuery([
        Has(this.components.Building),
        HasValue(this.components.Building, { outer_col: this.col, outer_row: this.row }),
        NotValue(this.components.Building, { entity_id: 0 }),
      ]),
    );

    const buildings = builtBuildings.map((entity) => {
      const productionModelValue = getComponentValue(this.components.Building, entity);
      const category = productionModelValue!.category;

      return {
        col: Number(productionModelValue?.inner_col),
        row: Number(productionModelValue?.inner_row),
        category,
        resource: getProducedResource(category),
        paused: productionModelValue?.paused,
        structureType: null,
      };
    });

    return buildings;
  };

  getBuilding = (hexCoords: HexPosition) => {
    const building = getComponentValue(
      this.components.Building,
      getEntityIdFromKeys([BigInt(this.col), BigInt(this.row), BigInt(hexCoords.col), BigInt(hexCoords.row)]),
    );
    return building;
  };

  isHexOccupied = (hexCoords: HexPosition) => {
    const { col, row } = hexCoords;

    // Check pending builds first to prevent race conditions
    const buildKey = `${this.col},${this.row},${col},${row}`;
    if (pendingBuilds.has(buildKey)) {
      return true;
    }

    const building = getComponentValue(
      this.components.Building,
      getEntityIdFromKeys([BigInt(this.col), BigInt(this.row), BigInt(col), BigInt(row)]),
    );
    return building !== undefined && building.category !== BuildingType.None;
  };

  structureType = () => {
    const tile = getTileAt(this.components, DEFAULT_COORD_ALT, this.col, this.row);

    if (tile?.occupier_is_structure) {
      const structure = getComponentValue(this.components.Structure, getEntityIdFromKeys([BigInt(tile?.occupier_id)]));
      if (structure) {
        let category = structure.base.category;
        return category as StructureType;
      }
    }
  };

  private _getBonusFromNeighborBuildings = (col: number, row: number) => {
    const neighborBuildingCoords = getNeighborHexes(col, row);

    let bonusPercent = 0;
    neighborBuildingCoords.map((coord) => {
      const building = getComponentValue(
        this.components.Building,
        getEntityIdFromKeys([BigInt(this.col), BigInt(this.row), BigInt(coord.col), BigInt(coord.row)]),
      );

      if (building?.category === BuildingType.ResourceWheat) bonusPercent += building.bonus_percent;
    });

    return bonusPercent;
  };

  private _optimisticBuilding = (
    entityId: ID,
    col: number,
    row: number,
    buildingType: BuildingType,
    useSimpleCost: boolean,
  ) => {
    let buildingOverrideId = uuid();
    const entity = getEntityIdFromKeys([this.col, this.row, col, row].map((v) => BigInt(v)));

    // override building
    this.components.Building.addOverride(buildingOverrideId, {
      entity,
      value: {
        outer_col: this.col,
        outer_row: this.row,
        inner_col: col,
        inner_row: row,
        category: buildingType,
        bonus_percent: this._getBonusFromNeighborBuildings(col, row),
        entity_id: entityId,
        outer_entity_id: entityId,
        paused: false,
      },
    });

    // override resource balance
    // need to retrieve the reosurce cost before adding extra building to the structure
    // because the resource cost increase when adding more buildings
    const resourceChange = getBuildingCosts(entityId, this.components, buildingType, useSimpleCost);

    const removeResourceOverrides: Array<() => void> = [];
    resourceChange?.forEach((resource) => {
      const removeOverride = this._overrideResource(entityId, resource.resource, -resource.amount);
      removeResourceOverrides.push(removeOverride);
    });

    const realmEntity = getEntityIdFromKeys([BigInt(entityId)]);
    const structureBuildings = getComponentValue(this.components.StructureBuildings, realmEntity);

    const quantityOverrideId = uuid();

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

    // override structure buildings
    this.components.StructureBuildings.addOverride(quantityOverrideId, {
      entity: realmEntity,
      value: {
        ...structureBuildings,
        packed_counts_1: packedBuildingCount[0],
        packed_counts_2: packedBuildingCount[1],
        packed_counts_3: packedBuildingCount[2],
        population: {
          current:
            (structureBuildings?.population.current || 0) +
            configManager.getBuildingCategoryConfig(buildingType)?.population_cost,
          max:
            (structureBuildings?.population.max || 0) +
            configManager.getBuildingCategoryConfig(buildingType)?.capacity_grant,
        },
      },
    });

    return () => {
      this.components.Building.removeOverride(buildingOverrideId);
      this.components.StructureBuildings.removeOverride(quantityOverrideId);
      removeResourceOverrides.forEach((removeOverride) => removeOverride());
    };
  };

  private _overrideResource = (entity: ID, resourceType: number, actualResourceChange: number) => {
    const resourceManager = new ResourceManager(this.components, entity);
    return resourceManager.optimisticResourceUpdate(resourceType, actualResourceChange);
  };

  private _optimisticDestroy = (entityId: ID, col: number, row: number) => {
    const overrideId = uuid();
    const realmBase = getComponentValue(this.components.Structure, getEntityIdFromKeys([BigInt(entityId)]))?.base;
    const { coord_x: outercol, coord_y: outerrow } = realmBase || { coord_x: 0, coord_y: 0 };
    const entity = getEntityIdFromKeys([outercol, outerrow, col, row].map((v) => BigInt(v)));

    const currentBuilding = getComponentValue(this.components.Building, entity);
    const type = currentBuilding?.category as BuildingType;

    this.components.Building.addOverride(overrideId, {
      entity,
      value: {
        ...currentBuilding,
        outer_col: outercol,
        outer_row: outerrow,
        inner_col: col,
        inner_row: row,
        category: BuildingType.None,
        bonus_percent: 0,
        entity_id: 0,
        outer_entity_id: 0,
      },
    });

    const populationOverrideId = uuid();

    const realmEntityId = getEntityIdFromKeys([BigInt(entityId)]);
    const currentStructureBuildings = getComponentValue(this.components.StructureBuildings, realmEntityId);

    // Get the current building count
    const buildingCount = getBuildingCount(type, [
      currentStructureBuildings?.packed_counts_1 || 0n,
      currentStructureBuildings?.packed_counts_2 || 0n,
      currentStructureBuildings?.packed_counts_3 || 0n,
    ]);

    // Decrease the count by 1 (ensuring it doesn't go below 0)
    const newCount = buildingCount > 0 ? buildingCount - 1 : 0;

    // Update the packed counts
    const packedBuildingCount = setBuildingCount(
      type,
      [
        currentStructureBuildings?.packed_counts_1 || 0n,
        currentStructureBuildings?.packed_counts_2 || 0n,
        currentStructureBuildings?.packed_counts_3 || 0n,
      ],
      newCount,
    );
    console.log("packedBuildingCount", packedBuildingCount, "newCount", newCount, "type", type);
    const newBuildingCount = getBuildingCount(type, [
      packedBuildingCount[0],
      packedBuildingCount[1],
      packedBuildingCount[2],
    ]);
    console.log("newBuildingCount", newBuildingCount, "type", type);

    this.components.StructureBuildings.addOverride(populationOverrideId, {
      entity: realmEntityId,
      value: {
        ...currentStructureBuildings,
        packed_counts_1: packedBuildingCount[0],
        packed_counts_2: packedBuildingCount[1],
        packed_counts_3: packedBuildingCount[2],
        population: {
          current:
            (currentStructureBuildings?.population.current || 0) -
            configManager.getBuildingCategoryConfig(type).population_cost,
          max:
            (currentStructureBuildings?.population.max || 0) -
            configManager.getBuildingCategoryConfig(type).capacity_grant,
        },
      },
    });

    return () => {
      console.log("removing overrides");
      this.components.Building.removeOverride(overrideId);
      this.components.StructureBuildings.removeOverride(populationOverrideId);
    };
  };

  private _optimisticPause = (col: number, row: number) => {
    let overrideId = uuid();
    const entity = getEntityIdFromKeys([this.col, this.row, col, row].map((v) => BigInt(v)));
    const building = getComponentValue(this.components.Building, entity);
    this.components.Building.addOverride(overrideId, {
      entity,
      value: {
        ...building,
        outer_col: building?.outer_col,
        outer_row: building?.outer_row,
        inner_col: building?.inner_col,
        inner_row: building?.inner_row,
        category: building?.category,
        bonus_percent: building?.bonus_percent,
        entity_id: building?.entity_id,
        outer_entity_id: building?.outer_entity_id,
        paused: true,
      },
    });
    return overrideId;
  };

  private _optimisticResume = (col: number, row: number) => {
    let overrideId = uuid();
    const entity = getEntityIdFromKeys([this.col, this.row, col, row].map((v) => BigInt(v)));
    const building = getComponentValue(this.components.Building, entity);
    this.components.Building.addOverride(overrideId, {
      entity,
      value: {
        ...building,
        outer_col: building?.outer_col,
        outer_row: building?.outer_row,
        inner_col: building?.inner_col,
        inner_row: building?.inner_row,
        category: building?.category,
        bonus_percent: building?.bonus_percent,
        entity_id: building?.entity_id,
        outer_entity_id: building?.outer_entity_id,
        paused: false,
      },
    });
    return overrideId;
  };

  placeBuilding = async (
    signer: DojoAccount,
    structureEntityId: ID,
    buildingType: BuildingType,
    hexCoords: HexPosition,
    useSimpleCost: boolean,
  ) => {
    const { col, row } = hexCoords;

    // Track this build as pending to prevent race conditions
    const buildKey = `${this.col},${this.row},${col},${row}`;
    pendingBuilds.add(buildKey);

    const startingPosition: [number, number] = [BUILDINGS_CENTER[0], BUILDINGS_CENTER[1]];
    const endPosition: [number, number] = [col, row];
    const directions = getDirectionsArray(startingPosition, endPosition);

    // add optimistic rendering
    const removeBuildingOverride = this._optimisticBuilding(structureEntityId, col, row, buildingType, useSimpleCost);

    try {
      const result = await this.systemCalls.create_building({
        signer,
        entity_id: structureEntityId,
        directions: directions,
        building_category: buildingType,
        use_simple: useSimpleCost,
      });

      // On success, delay override removal to allow Torii sync
      // The pendingBuilds Set ensures isHexOccupied returns true during this window
      setTimeout(() => {
        removeBuildingOverride();
        pendingBuilds.delete(buildKey);
      }, 500);

      return result;
    } catch (error) {
      // On error, remove immediately
      removeBuildingOverride();
      pendingBuilds.delete(buildKey);
      console.error(error);
      throw error;
    }
  };

  destroyBuilding = async (signer: DojoAccount, structureEntityId: ID, col: number, row: number) => {
    // add optimistic rendering
    const removeBuildingOverride = this._optimisticDestroy(structureEntityId, col, row);

    try {
      await this.systemCalls.destroy_building({
        signer,
        entity_id: structureEntityId,
        building_coord: {
          alt: DEFAULT_COORD_ALT,
          x: col,
          y: row,
        },
      });
    } catch (error) {
      console.log("error", error);
    } finally {
      removeBuildingOverride();
    }
  };

  pauseProduction = async (signer: DojoAccount, structureEntityId: ID, col: number, row: number) => {
    const overrideId = this._optimisticPause(col, row);

    try {
      await this.systemCalls.pause_production({
        signer,
        entity_id: structureEntityId,
        building_coord: {
          alt: DEFAULT_COORD_ALT,
          x: col,
          y: row,
        },
      });
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.components.Building.removeOverride(overrideId);
    }
  };

  resumeProduction = async (signer: DojoAccount, structureEntityId: ID, col: number, row: number) => {
    const overrideId = this._optimisticResume(col, row);

    try {
      await this.systemCalls.resume_production({
        signer,
        entity_id: structureEntityId,
        building_coord: {
          alt: DEFAULT_COORD_ALT,
          x: col,
          y: row,
        },
      });
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.components.Building.removeOverride(overrideId);
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
