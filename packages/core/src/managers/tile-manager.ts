import { Entity, Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { CairoOption, CairoOptionVariant } from "starknet";
import { ResourceManager, packValues, unpackValue, type DojoAccount } from "..";
import {
  BUILDINGS_CENTER,
  BuildingType,
  DUMMY_HYPERSTRUCTURE_ENTITY_ID,
  Direction,
  FELT_CENTER,
  RealmLevels,
  ResourcesIds,
  StructureType,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
} from "../constants";
import { ClientComponents } from "../dojo/create-client-components";
import { SystemCalls } from "../dojo/create-system-calls";
import { HexPosition, ID, Position } from "../types";
import { configManager } from "./config-manager";

export class TileManager {
  private col: number;
  private row: number;

  constructor(
    private readonly components: ClientComponents,
    private readonly systemCalls: SystemCalls,
    hexCoords: HexPosition,
  ) {
    this.col = hexCoords.col;
    this.row = hexCoords.row;
  }

  getHexCoords = () => {
    return { col: this.col, row: this.row };
  };

  setTile(hexCoords: HexPosition) {
    this.col = hexCoords.col + FELT_CENTER;
    this.row = hexCoords.row + FELT_CENTER;
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
        resource: productionModelValue?.produced_resource_type,
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
    const building = getComponentValue(
      this.components.Building,
      getEntityIdFromKeys([BigInt(this.col), BigInt(this.row), BigInt(hexCoords.col), BigInt(hexCoords.row)]),
    );
    return building !== undefined && building.category !== BuildingType[BuildingType.None];
  };

  structureType = () => {
    const tile = getComponentValue(
      this.components.Tile,
      getEntityIdFromKeys([BigInt(this.col), BigInt(this.row)]),
    );

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

      if (building?.category === BuildingType[BuildingType.Farm]) bonusPercent += building.bonus_percent;
    });

    return bonusPercent;
  };

  private _getProducedResourceType = (buildingType: BuildingType, resourceType: number | undefined) => {
    let producedResourceType = 0;

    switch (buildingType) {
      case BuildingType.Farm:
        producedResourceType = ResourcesIds.Wheat;
        break;
      case BuildingType.FishingVillage:
        producedResourceType = ResourcesIds.Fish;
        break;
      case BuildingType.Barracks:
        producedResourceType = ResourcesIds.Knight;
        break;
      case BuildingType.ArcheryRange:
        producedResourceType = ResourcesIds.Crossbowman;
        break;
      case BuildingType.Stable:
        producedResourceType = ResourcesIds.Paladin;
        break;
      case BuildingType.Resource:
        producedResourceType = resourceType!;
        break;
    }

    return producedResourceType;
  };

  private _optimisticBuilding = (
    entityId: ID,
    col: number,
    row: number,
    buildingType: BuildingType,
    resourceType?: number,
  ) => {
    let overrideId = uuid();
    const entity = getEntityIdFromKeys([this.col, this.row, col, row].map((v) => BigInt(v)));

    this.components.Building.addOverride(overrideId, {
      entity,
      value: {
        outer_col: this.col,
        outer_row: this.row,
        inner_col: col,
        inner_row: row,
        category: BuildingType[buildingType],
        produced_resource_type: this._getProducedResourceType(buildingType, resourceType),
        bonus_percent: this._getBonusFromNeighborBuildings(col, row),
        entity_id: entityId,
        outer_entity_id: entityId,
        paused: false,
      },
    });

    const populationOverrideId = uuid();

    const realmEntity = getEntityIdFromKeys([BigInt(entityId)]);
    const structureBuildings = getComponentValue(this.components.StructureBuildings, realmEntity);

    this.components.StructureBuildings.addOverride(populationOverrideId, {
      entity: realmEntity,
      value: {
        ...structureBuildings,
        population: {
          current:
            (structureBuildings?.population.current || 0) + configManager.getBuildingPopConfig(buildingType).population,
          max: (structureBuildings?.population.max || 0) + configManager.getBuildingPopConfig(buildingType).capacity,
        },
      },
    });

    const quantityOverrideId = uuid();

    const buildingCounts = unpackValue(structureBuildings?.packed_counts || 0n);

    // Ensure array has values at all indices up to buildingType
    while (buildingCounts.length <= buildingType) {
      buildingCounts.push(0);
    }
    buildingCounts[buildingType] = (buildingCounts[buildingType] || 0) + 1;

    let packedBuildingCount;
    try {
      packedBuildingCount = packValues(buildingCounts);
    } catch (error) {
      packedBuildingCount = "0"; // Default fallback value
    }

    this.components.StructureBuildings.addOverride(quantityOverrideId, {
      entity: realmEntity,
      value: {
        ...structureBuildings,
        packed_counts: BigInt(packedBuildingCount),
      },
    });

    const resourceChange = configManager.buildingCosts[buildingType];
    resourceChange.forEach((resource) => {
      this._overrideResource(entityId, resource.resource, -BigInt(resource.amount));
    });

    return { overrideId, populationOverrideId, quantityOverrideId };
  };

  private _overrideResource = (entity: ID, resourceType: number, change: bigint) => {
    const resourceManager = new ResourceManager(this.components, entity, resourceType);
    const overrideId = uuid();
    resourceManager.optimisticResourceUpdate(overrideId, change);
  };

  private _optimisticDestroy = (entityId: ID, col: number, row: number) => {
    const overrideId = uuid();
    const realmBase = getComponentValue(this.components.Structure, getEntityIdFromKeys([BigInt(entityId)]))?.base;
    const { coord_x: outercol, coord_y: outerrow } = realmBase || { coord_x: 0, coord_y: 0 };
    const entity = getEntityIdFromKeys([outercol, outerrow, col, row].map((v) => BigInt(v)));

    const currentBuilding = getComponentValue(this.components.Building, entity);

    this.components.Building.addOverride(overrideId, {
      entity,
      value: {
        ...currentBuilding,
        outer_col: outercol,
        outer_row: outerrow,
        inner_col: col,
        inner_row: row,
        category: "None",
        produced_resource_type: 0,
        bonus_percent: 0,
        entity_id: 0,
        outer_entity_id: 0,
      },
    });

    const populationOverrideId = uuid();

    const realmEntityId = getEntityIdFromKeys([BigInt(entityId)]);

    const type = BuildingType[currentBuilding?.category as keyof typeof BuildingType];

    const currentStructureBuildings = getComponentValue(this.components.StructureBuildings, realmEntityId);

    this.components.StructureBuildings.addOverride(populationOverrideId, {
      entity: realmEntityId,
      value: {
        ...currentStructureBuildings,
        population: {
          current:
            (getComponentValue(this.components.StructureBuildings, realmEntityId)?.population.current || 0) -
            configManager.getBuildingPopConfig(type).population,
          max:
            (getComponentValue(this.components.StructureBuildings, realmEntityId)?.population.max || 0) -
            configManager.getBuildingPopConfig(type).capacity,
        },
      },
    });

    return overrideId;
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
        produced_resource_type: building?.produced_resource_type,
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
        produced_resource_type: building?.produced_resource_type,
        bonus_percent: building?.bonus_percent,
        entity_id: building?.entity_id,
        outer_entity_id: building?.outer_entity_id,
        paused: false,
      },
    });
    return overrideId;
  };

  private _optimisticStructure = (coords: Position, structureType: StructureType) => {
    const overrideId = DUMMY_HYPERSTRUCTURE_ENTITY_ID.toString();
    const entity: Entity = getEntityIdFromKeys([BigInt(DUMMY_HYPERSTRUCTURE_ENTITY_ID)]);
    const structure = getComponentValue(this.components.Structure, entity);

    if (structure) {
      this.components.Structure.addOverride(overrideId, {
        entity,
        value: {
          ...structure,
          base: {
            ...structure?.base,
            category: Number(structureType),
            coord_x: coords.x,
            coord_y: coords.y,
          },
          entity_id: Number(DUMMY_HYPERSTRUCTURE_ENTITY_ID),
        },
      });
    }

    return { overrideId };
  };

  placeBuilding = async (
    signer: DojoAccount,
    structureEntityId: ID,
    buildingType: BuildingType,
    hexCoords: HexPosition,
    resourceType?: number,
  ) => {
    const { col, row } = hexCoords;

    const startingPosition: [number, number] = [BUILDINGS_CENTER[0], BUILDINGS_CENTER[1]];
    const endPosition: [number, number] = [col, row];
    const directions = getDirectionsArray(startingPosition, endPosition);

    // add optimistic rendering
    const { overrideId, populationOverrideId } = this._optimisticBuilding(
      structureEntityId,
      col,
      row,
      buildingType,
      resourceType,
    );

    try {
      await this.systemCalls.create_building({
        signer,
        entity_id: structureEntityId,
        directions: directions,
        building_category: buildingType,
        produce_resource_type:
          buildingType == BuildingType.Resource && resourceType
            ? new CairoOption<Number>(CairoOptionVariant.Some, resourceType)
            : new CairoOption<Number>(CairoOptionVariant.None, 0),
      });
    } catch (error) {
      this.components.Building.removeOverride(overrideId);
      this.components.StructureBuildings.removeOverride(populationOverrideId);
      this.components.Structure.removeOverride(overrideId);

      console.error(error);
      throw error;
    }
  };

  destroyBuilding = async (signer: DojoAccount, structureEntityId: ID, col: number, row: number) => {
    // add optimistic rendering
    const overrideId = this._optimisticDestroy(structureEntityId, col, row);

    try {
      await this.systemCalls.destroy_building({
        signer,
        entity_id: structureEntityId,
        building_coord: {
          x: col,
          y: row,
        },
      });
    } catch (error) {
      this.components.Building.removeOverride(overrideId);
      console.error(error);
      throw error;
    }
  };

  pauseProduction = async (signer: DojoAccount, structureEntityId: ID, col: number, row: number) => {
    const overrideId = this._optimisticPause(col, row);

    try {
      await this.systemCalls.pause_production({
        signer,
        entity_id: structureEntityId,
        building_coord: {
          x: col,
          y: row,
        },
      });
    } catch (error) {
      this.components.Building.removeOverride(overrideId);
      console.error(error);
      throw error;
    }
  };

  resumeProduction = async (signer: DojoAccount, structureEntityId: ID, col: number, row: number) => {
    const overrideId = this._optimisticResume(col, row);

    try {
      await this.systemCalls.resume_production({
        signer,
        entity_id: structureEntityId,
        building_coord: {
          x: col,
          y: row,
        },
      });
    } catch (error) {
      this.components.Building.removeOverride(overrideId);
      console.error(error);
      throw error;
    }
  };

  placeStructure = async (signer: DojoAccount, entityId: ID, structureType: StructureType, coords: Position) => {
    const { overrideId } = this._optimisticStructure(coords, structureType);
    try {
      if (structureType == StructureType.Hyperstructure) {
        return await this.systemCalls.create_hyperstructure({
          signer,
          creator_entity_id: entityId,
          coords,
        });
      }
    } catch (error) {
      this.components.Structure.removeOverride(overrideId);
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
