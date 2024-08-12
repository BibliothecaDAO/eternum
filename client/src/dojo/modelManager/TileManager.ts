import { BuildingStringToEnum, BuildingType, ID, StructureType } from "@bibliothecadao/eternum";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  Component,
  Has,
  HasValue,
  NotValue,
  OverridableComponent,
  getComponentValue,
  runQuery,
} from "@dojoengine/recs";
import { ClientComponents } from "../createClientComponents";
import { SetupResult } from "../setup";
import { HexPosition } from "@/types";
import { uuid } from "@latticexyz/utils";
import { CairoOption, CairoOptionVariant } from "starknet";
import { FELT_CENTER } from "@/ui/config";
import useRealmStore from "@/hooks/store/useRealmStore";

export class TileManager {
  private models: {
    tile: OverridableComponent<ClientComponents["Tile"]["schema"]>;
    building: OverridableComponent<ClientComponents["Building"]["schema"]>;
    structure: Component<ClientComponents["Structure"]["schema"]>;
    stamina: OverridableComponent<ClientComponents["Stamina"]["schema"]>;
    position: OverridableComponent<ClientComponents["Position"]["schema"]>;
    army: Component<ClientComponents["Army"]["schema"]>;
    owner: Component<ClientComponents["Owner"]["schema"]>;
    entityOwner: Component<ClientComponents["EntityOwner"]["schema"]>;
    staminaConfig: Component<ClientComponents["StaminaConfig"]["schema"]>;
  };
  private col: number;
  private row: number;
  private address: bigint;

  constructor(private dojo: SetupResult, hexCoords: HexPosition) {
    const { Tile, Building, Stamina, Position, Army, Owner, EntityOwner, StaminaConfig, Structure } = dojo.components;
    this.models = {
      tile: Tile,
      building: Building,
      structure: Structure,
      stamina: Stamina,
      position: Position,
      army: Army,
      owner: Owner,
      entityOwner: EntityOwner,
      staminaConfig: StaminaConfig,
    };
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
        Has(this.models.building),
        HasValue(this.models.building, { outer_col: this.col, outer_row: this.row }),
        NotValue(this.models.building, { entity_id: 0 }),
      ]),
    );

    const buildings = builtBuildings.map((entity) => {
      const productionModelValue = getComponentValue(this.models.building, entity);
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
      this.models.building,
      getEntityIdFromKeys([BigInt(this.col), BigInt(this.row), BigInt(hexCoords.col), BigInt(hexCoords.row)]),
    );
    return building?.category !== undefined;
  };

  structureType = () => {
    const structures = Array.from(
      runQuery([Has(this.models.structure), HasValue(this.models.position, { x: this.col, y: this.row })]),
    );
    if (structures?.length === 1) {
      const structure = getComponentValue(this.models.structure, structures[0])!;
      let category = structure.category;
      return StructureType[category as keyof typeof StructureType];
    }
  };

  private _getOwnerEntityId = () => {
    const entities = Array.from(
      runQuery([
        Has(this.models.structure),
        HasValue(this.models.owner, { address: this.address }),
        HasValue(this.models.position, { x: this.col, y: this.row }),
      ]),
    );

    if (entities.length === 1) {
      return getComponentValue(this.models.owner, entities[0])!.entity_id;
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
    this.models.building.addOverride(overrideId, {
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
      },
    });
    return overrideId;
  };

  private _optimisticDestroy = (entityId: ID, col: number, row: number) => {
    const overrideId = uuid();
    const realmPosition = getComponentValue(this.models.position, getEntityIdFromKeys([BigInt(entityId)]));
    const { x: outercol, y: outerrow } = realmPosition || { x: 0, y: 0 };
    const entity = getEntityIdFromKeys([outercol, outerrow, col, row].map((v) => BigInt(v)));
    this.models.building.addOverride(overrideId, {
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
          x: col.toString(),
          y: row.toString(),
        },
        building_category: buildingType,
        produce_resource_type:
          buildingType == BuildingType.Resource && resourceType
            ? new CairoOption<Number>(CairoOptionVariant.Some, resourceType)
            : new CairoOption<Number>(CairoOptionVariant.None, 0),
      })
      .finally(() => {
        setTimeout(() => {
          this.models.building.removeOverride(overrideId);
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
          x: col.toString(),
          y: row.toString(),
        },
      })
      .finally(() => {
        setTimeout(() => {
          this.models.building.removeOverride(overrideId);
        }, 2000);
      });
  };

  placeStructure = async (structureType: StructureType, hexCoords: HexPosition) => {
    const entityId = useRealmStore.getState().realmEntityId;

    if (structureType == StructureType.Hyperstructure) {
      await this.dojo.systemCalls.create_hyperstructure({
        signer: this.dojo.network.burnerManager.account!,
        creator_entity_id: BigInt(entityId || 0),
        coords: {
          x: hexCoords.col.toString(),
          y: hexCoords.row.toString(),
        },
      });
    }
  };
}
