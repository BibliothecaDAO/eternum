import { useAccountStore } from "@/hooks/context/accountStore";
import { BUILDINGS_CENTER } from "@/three/scenes/constants";
import { playBuildingSound } from "@/three/scenes/Hexception";
import { HexPosition } from "@/types";
import { FELT_CENTER } from "@/ui/config";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  BuildingType,
  Direction,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
  ID,
  Position,
  RealmLevels,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/eternum";
import { getComponentValue, Has, HasValue, NotValue, runQuery } from "@dojoengine/recs";
import { uuid } from "@latticexyz/utils";
import { AccountInterface, CairoOption, CairoOptionVariant } from "starknet";
import { SetupResult } from "../setup";

export class TileManager {
  private col: number;
  private row: number;
  private address: bigint;
  private account: AccountInterface | null;

  constructor(
    private setup: SetupResult,
    hexCoords: HexPosition,
  ) {
    this.col = hexCoords.col;
    this.row = hexCoords.row;

    this.account = null;
    this.address = BigInt(useAccountStore.getState().account?.address || 0n);

    useAccountStore.subscribe((state) => {
      const account = state.account;
      if (account) {
        this.address = BigInt(account.address);
        this.account = account;
      }
    });
  }

  getHexCoords = () => {
    return { col: this.col, row: this.row };
  };

  setTile(hexCoords: HexPosition) {
    this.col = hexCoords.col + FELT_CENTER;
    this.row = hexCoords.row + FELT_CENTER;
  }

  getRealmLevel = (): RealmLevels => {
    const realmEntityId = this._getOwnerEntityId() || 0;
    const realm = getComponentValue(this.setup.components.Realm, getEntityIdFromKeys([BigInt(realmEntityId)]));
    return (realm?.level || RealmLevels.Settlement) as RealmLevels;
  };

  existingBuildings = () => {
    const builtBuildings = Array.from(
      runQuery([
        Has(this.setup.components.Building),
        HasValue(this.setup.components.Building, { outer_col: this.col, outer_row: this.row }),
        NotValue(this.setup.components.Building, { entity_id: 0 }),
      ]),
    );

    const buildings = builtBuildings.map((entity) => {
      const productionModelValue = getComponentValue(this.setup.components.Building, entity);
      const category = productionModelValue!.category;

      return {
        col: Number(productionModelValue?.inner_col),
        row: Number(productionModelValue?.inner_row),
        category,
        resource: productionModelValue?.produced_resource_type,
        paused: productionModelValue?.paused,
      };
    });

    return buildings;
  };

  getBuilding = (hexCoords: HexPosition) => {
    const building = getComponentValue(
      this.setup.components.Building,
      getEntityIdFromKeys([BigInt(this.col), BigInt(this.row), BigInt(hexCoords.col), BigInt(hexCoords.row)]),
    );
    return building;
  };

  isHexOccupied = (hexCoords: HexPosition) => {
    const building = getComponentValue(
      this.setup.components.Building,
      getEntityIdFromKeys([BigInt(this.col), BigInt(this.row), BigInt(hexCoords.col), BigInt(hexCoords.row)]),
    );
    return building !== undefined && building.category !== BuildingType[BuildingType.None];
  };

  structureType = () => {
    const structures = Array.from(
      runQuery([
        Has(this.setup.components.Structure),
        HasValue(this.setup.components.Position, { x: this.col, y: this.row }),
      ]),
    );
    if (structures?.length === 1) {
      const structure = getComponentValue(this.setup.components.Structure, structures[0])!;
      let category = structure.category;
      return StructureType[category as keyof typeof StructureType];
    }
  };

  private _getOwnerEntityId = () => {
    const entities = Array.from(
      runQuery([
        Has(this.setup.components.Owner),
        HasValue(this.setup.components.Owner, { address: this.address }),
        HasValue(this.setup.components.Position, { x: this.col, y: this.row }),
      ]),
    );

    if (entities.length === 1) {
      return getComponentValue(this.setup.components.Owner, entities[0])!.entity_id;
    }
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

    let produced_resource_type = 0;

    switch (buildingType) {
      case BuildingType.Farm:
        produced_resource_type = ResourcesIds.Wheat;
        break;
      case BuildingType.FishingVillage:
        produced_resource_type = ResourcesIds.Fish;
        break;
      case BuildingType.Resource:
        produced_resource_type = resourceType || 0;
        break;
    }

    this.setup.components.Building.addOverride(overrideId, {
      entity,
      value: {
        outer_col: this.col,
        outer_row: this.row,
        inner_col: col,
        inner_row: row,
        category: BuildingType[buildingType],
        produced_resource_type,
        bonus_percent: 0,
        entity_id: entityId,
        outer_entity_id: entityId,
        paused: false,
      },
    });
    return overrideId;
  };

  private _optimisticDestroy = (entityId: ID, col: number, row: number) => {
    const overrideId = uuid();
    const realmPosition = getComponentValue(this.setup.components.Position, getEntityIdFromKeys([BigInt(entityId)]));
    const { x: outercol, y: outerrow } = realmPosition || { x: 0, y: 0 };
    const entity = getEntityIdFromKeys([outercol, outerrow, col, row].map((v) => BigInt(v)));
    this.setup.components.Building.addOverride(overrideId, {
      entity,
      value: {
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
    return overrideId;
  };

  private _optimisticPause = (col: number, row: number) => {
    let overrideId = uuid();
    const entity = getEntityIdFromKeys([this.col, this.row, col, row].map((v) => BigInt(v)));
    const building = getComponentValue(this.setup.components.Building, entity);
    this.setup.components.Building.addOverride(overrideId, {
      entity,
      value: {
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
    const building = getComponentValue(this.setup.components.Building, entity);
    this.setup.components.Building.addOverride(overrideId, {
      entity,
      value: {
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

  placeBuilding = async (buildingType: BuildingType, hexCoords: HexPosition, resourceType?: number) => {
    const entityId = this._getOwnerEntityId();
    if (!entityId) throw new Error("TileManager: Not Owner of the Tile");
    const { col, row } = hexCoords;

    const startingPosition: [number, number] = [BUILDINGS_CENTER[0], BUILDINGS_CENTER[1]];
    const endPosition: [number, number] = [col, row];
    const directions = getDirectionsArray(startingPosition, endPosition);

    // add optimistic rendering
    const _ = this._optimisticBuilding(entityId, col, row, buildingType, resourceType);

    playBuildingSound(buildingType);

    await this.setup.systemCalls.create_building({
      signer: this.account!,
      entity_id: entityId,
      directions: directions,
      building_category: buildingType,
      produce_resource_type:
        buildingType == BuildingType.Resource && resourceType
          ? new CairoOption<Number>(CairoOptionVariant.Some, resourceType)
          : new CairoOption<Number>(CairoOptionVariant.None, 0),
    });
  };

  destroyBuilding = async (col: number, row: number) => {
    const entityId = this._getOwnerEntityId();

    if (!entityId) throw new Error("TileManager: Not Owner of the Tile");
    // add optimistic rendering
    this._optimisticDestroy(entityId, col, row);

    await this.setup.systemCalls.destroy_building({
      signer: this.account!,
      entity_id: entityId,
      building_coord: {
        x: col,
        y: row,
      },
    });
  };

  pauseProduction = async (col: number, row: number) => {
    const entityId = this._getOwnerEntityId();
    if (!entityId) throw new Error("TileManager: Not Owner of the Tile");

    this._optimisticPause(col, row);

    await this.setup.systemCalls.pause_production({
      signer: this.account!,
      entity_id: entityId,
      building_coord: {
        x: col,
        y: row,
      },
    });
  };

  resumeProduction = async (col: number, row: number) => {
    const entityId = this._getOwnerEntityId();
    if (!entityId) throw new Error("TileManager: Not Owner of the Tile");

    this._optimisticResume(col, row);

    await this.setup.systemCalls.resume_production({
      signer: this.account!,
      entity_id: entityId,
      building_coord: {
        x: col,
        y: row,
      },
    });
  };

  placeStructure = async (entityId: ID, structureType: StructureType, coords: Position) => {
    if (structureType == StructureType.Hyperstructure) {
      await this.setup.systemCalls.create_hyperstructure({
        signer: this.account!,
        creator_entity_id: entityId,
        coords,
      });
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
