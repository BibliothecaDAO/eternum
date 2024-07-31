import { BuildingType, ID } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { CairoOption, CairoOptionVariant } from "starknet";
import { useDojo } from "../context/DojoContext";

export function useBuildings() {
  const {
    account: { account },
    setup: {
      components: { Building, Position },
      systemCalls: { create_building, destroy_building },
    },
  } = useDojo();

  const optimisticBuilding = (
    entityId: ID,
    col: number,
    row: number,
    buildingType: BuildingType,
    resourceType?: ID,
  ) => {
    let overrideId = uuid();
    const realmPosition = getComponentValue(Position, getEntityIdFromKeys([BigInt(entityId)]));
    const { x: outercol, y: outerrow } = realmPosition || { x: 0, y: 0 };
    const entity = getEntityIdFromKeys([outercol, outerrow, col, row].map((v) => BigInt(v)));
    Building.addOverride(overrideId, {
      entity,
      value: {
        outer_col: outercol,
        outer_row: outerrow,
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

  const optimisticDestroy = (entityId: ID, col: number, row: number) => {
    const overrideId = uuid();
    const realmPosition = getComponentValue(Position, getEntityIdFromKeys([BigInt(entityId)]));
    const { x: outercol, y: outerrow } = realmPosition || { x: 0, y: 0 };
    const entity = getEntityIdFromKeys([outercol, outerrow, col, row].map((v) => BigInt(v)));
    Building.addOverride(overrideId, {
      entity,
      value: {
        outer_col: outercol,
        outer_row: outerrow,
        inner_col: col,
        inner_row: row,
        category: "",
        produced_resource_type: 0,
        bonus_percent: 0,
        entity_id: 0,
        outer_entity_id: 0,
      },
    });
    return overrideId;
  };

  const placeBuilding = async (
    realmEntityId: ID,
    col: number,
    row: number,
    buildingType: BuildingType,
    resourceType?: ID,
  ) => {
    // add optimisitc rendering
    let overrideId = optimisticBuilding(realmEntityId, col, row, buildingType, resourceType);

    await create_building({
      signer: account,
      entity_id: realmEntityId,
      building_coord: {
        x: col.toString(),
        y: row.toString(),
      },
      building_category: buildingType,
      produce_resource_type:
        buildingType == BuildingType.Resource && resourceType
          ? new CairoOption<Number>(CairoOptionVariant.Some, resourceType)
          : new CairoOption<Number>(CairoOptionVariant.None, 0),
    }).finally(() => {
      setTimeout(() => {
        Building.removeOverride(overrideId);
      }, 2000);
    });
  };

  const destroyBuilding = async (realmEntityId: ID, col: number, row: number) => {
    // add optimisitc rendering
    let overrideId = optimisticDestroy(realmEntityId, col, row);

    await destroy_building({
      signer: account,
      entity_id: realmEntityId,
      building_coord: {
        x: col.toString(),
        y: row.toString(),
      },
    }).finally(() => {
      setTimeout(() => {
        Building.removeOverride(overrideId);
      }, 2000);
    });
  };

  return { placeBuilding, destroyBuilding };
}
