import { BuildingType, ID, StructureType } from "@bibliothecadao/eternum";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import { Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { SetupResult } from "../setup";
import { HexPosition } from "@/types";
import { uuid } from "@latticexyz/utils";
import { CairoOption, CairoOptionVariant } from "starknet";
import { FELT_CENTER } from "@/ui/config";

export class TileManager {
  private col: number;
  private row: number;
  private address: bigint;

  constructor(
    private dojo: SetupResult,
    hexCoords: HexPosition,
  ) {
    this.col = hexCoords.col;
    this.row = hexCoords.row;
    this.address = BigInt(this.dojo.network.burnerManager.account?.address || 0n);
  }

  getHexCoords = () => {
    return { col: this.col, row: this.row };
  };

  setTile(hexCoords: HexPosition) {
    this.col = hexCoords.col + FELT_CENTER;
    this.row = hexCoords.row + FELT_CENTER;
  }

  existingBuildings = () => {
    const builtBuildings = Array.from(
      runQuery([
        Has(this.dojo.components.Building),
        HasValue(this.dojo.components.Building, { outer_col: this.col, outer_row: this.row }),
        NotValue(this.dojo.components.Building, { entity_id: 0 }),
      ]),
    );

    const buildings = builtBuildings.map((entity) => {
      const productionModelValue = getComponentValue(this.dojo.components.Building, entity);
      const category = productionModelValue!.category;

      return {
        col: Number(productionModelValue?.inner_col),
        row: Number(productionModelValue?.inner_row),
        category,
        resource: productionModelValue?.produced_resource_type,
      };
    });

    return buildings;
  };

  isHexOccupied = (hexCoords: HexPosition) => {
    const building = getComponentValue(
      this.dojo.components.Building,
      getEntityIdFromKeys([BigInt(this.col), BigInt(this.row), BigInt(hexCoords.col), BigInt(hexCoords.row)]),
    );
    return building !== undefined && building.category !== BuildingType[BuildingType.None];
  };

  structureType = () => {
    const structures = Array.from(
      runQuery([
        Has(this.dojo.components.Structure),
        HasValue(this.dojo.components.Position, { x: this.col, y: this.row }),
      ]),
    );
    if (structures?.length === 1) {
      const structure = getComponentValue(this.dojo.components.Structure, structures[0])!;
      let category = structure.category;
      return StructureType[category as keyof typeof StructureType];
    }
  };

  private _getOwnerEntityId = () => {
    const entities = Array.from(
      runQuery([
        Has(this.dojo.components.Owner),
        HasValue(this.dojo.components.Owner, { address: this.address }),
        HasValue(this.dojo.components.Position, { x: this.col, y: this.row }),
      ]),
    );

    if (entities.length === 1) {
      return getComponentValue(this.dojo.components.Owner, entities[0])!.entity_id;
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
    this.dojo.components.Building.addOverride(overrideId, {
      entity,
      value: {
        outer_col: this.col,
        outer_row: this.row,
        inner_col: col,
        inner_row: row,
        category: BuildingType[buildingType],
        produced_resource_type: resourceType ? resourceType : 0,
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
    const realmPosition = getComponentValue(this.dojo.components.Position, getEntityIdFromKeys([BigInt(entityId)]));
    const { x: outercol, y: outerrow } = realmPosition || { x: 0, y: 0 };
    const entity = getEntityIdFromKeys([outercol, outerrow, col, row].map((v) => BigInt(v)));
    this.dojo.components.Building.addOverride(overrideId, {
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

  placeBuilding = async (buildingType: BuildingType, hexCoords: HexPosition, resourceType?: number) => {
    const entityId = this._getOwnerEntityId();
    if (!entityId) throw new Error("TileManager: Not Owner of the Tile");
    const { col, row } = hexCoords;

    // add optimistic rendering
    let overrideId = this._optimisticBuilding(entityId, col, row, buildingType, resourceType);

    await this.dojo.systemCalls
      .create_building({
        signer: this.dojo.network.burnerManager.account!,
        entity_id: entityId,
        building_coord: {
          x: col,
          y: row,
        },
        building_category: buildingType,
        produce_resource_type:
          buildingType == BuildingType.Resource && resourceType
            ? new CairoOption<Number>(CairoOptionVariant.Some, resourceType)
            : new CairoOption<Number>(CairoOptionVariant.None, 0),
      })
      .finally(() => {
        setTimeout(() => {
          this.dojo.components.Building.removeOverride(overrideId);
        }, 2000);
      });
  };

  destroyBuilding = async (col: number, row: number) => {
    const entityId = this._getOwnerEntityId();

    if (!entityId) throw new Error("TileManager: Not Owner of the Tile");
    // add optimistic rendering
    let overrideId = this._optimisticDestroy(entityId, col, row);

    await this.dojo.systemCalls
      .destroy_building({
        signer: this.dojo.network.burnerManager.account!,
        entity_id: entityId,
        building_coord: {
          x: col,
          y: row,
        },
      })
      .finally(() => {
        setTimeout(() => {
          this.dojo.components.Building.removeOverride(overrideId);
        }, 2000);
      });
  };

  pauseProduction = async (col: number, row: number) => {
    const entityId = this._getOwnerEntityId();
    if (!entityId) throw new Error("TileManager: Not Owner of the Tile");

    await this.dojo.systemCalls.pause_production({
      signer: this.dojo.network.burnerManager.account!,
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

    await this.dojo.systemCalls.resume_production({
      signer: this.dojo.network.burnerManager.account!,
      entity_id: entityId,
      building_coord: {
        x: col,
        y: row,
      },
    });
  };

  placeStructure = async (entityId: ID, structureType: StructureType, hexCoords: HexPosition) => {
    if (structureType == StructureType.Hyperstructure) {
      await this.dojo.systemCalls.create_hyperstructure({
        signer: this.dojo.network.burnerManager.account!,
        creator_entity_id: entityId,
        coords: {
          x: hexCoords.col,
          y: hexCoords.row,
        },
      });
    }
  };
}
