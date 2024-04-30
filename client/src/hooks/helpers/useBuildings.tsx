import { BuildingType } from "@bibliothecadao/eternum";
import { useDojo } from "../context/DojoContext";
import { CairoOption, CairoOptionVariant } from "starknet";
import { uuid } from "@latticexyz/utils";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { getComponentValue } from "@dojoengine/recs";

export function useBuildings() {
  const {
    account: { account },
    setup: {
      components: { Building, Position },
      systemCalls: { create_building, destroy_building },
    },
  } = useDojo();

  const optimisticBuilding = (entityId: bigint, col: number, row: number, buildingType: BuildingType) => {
    let overrideId = uuid();
    const realmPosition = getComponentValue(Position, getEntityIdFromKeys([entityId]));
    const { x: outercol, y: outerrow } = realmPosition || { x: 0, y: 0 };
    const entity = getEntityIdFromKeys([outercol, outerrow, col, row].map((v) => BigInt(v)));
    Building.addOverride(overrideId, {
      entity,
      value: {
        outer_col: BigInt(outercol),
        outer_row: BigInt(outerrow),
        inner_col: BigInt(col),
        inner_row: BigInt(row),
        category: BuildingType[buildingType],
        produced_resource_type: 0,
        bonus_percent: 0n,
        entity_id: entityId,
        outer_entity_id: entityId,
      },
    });
    return overrideId;
  };

  const optimisticDestroy = (entityId: bigint, col: number, row: number) => {
    const overrideId = uuid();
    const realmPosition = getComponentValue(Position, getEntityIdFromKeys([entityId]));
    const { x: outercol, y: outerrow } = realmPosition || { x: 0, y: 0 };
    const entity = getEntityIdFromKeys([outercol, outerrow, col, row].map((v) => BigInt(v)));
    Building.addOverride(overrideId, {
      entity,
      value: {
        outer_col: BigInt(outercol),
        outer_row: BigInt(outerrow),
        inner_col: BigInt(col),
        inner_row: BigInt(row),
        category: "None",
        produced_resource_type: 0,
        bonus_percent: 0n,
        entity_id: 0n,
        outer_entity_id: 0n,
      },
    });
    return overrideId;
  };

  const placeBuilding = async (
    realmEntityId: bigint,
    col: number,
    row: number,
    buildingType: BuildingType,
    resourceType?: number,
  ) => {
    // add optimisitc rendering
    let overrideId = optimisticBuilding(realmEntityId, col, row, buildingType);

    await create_building({
      signer: account,
      entity_id: realmEntityId as bigint,
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
      Building.removeOverride(overrideId);
    });
  };

  const destroyBuilding = async (realmEntityId: bigint, col: number, row: number) => {
    // add optimisitc rendering
    let overrideId = optimisticDestroy(realmEntityId, col, row);

    await destroy_building({
      signer: account,
      entity_id: realmEntityId as bigint,
      building_coord: {
        x: col.toString(),
        y: row.toString(),
      },
    }).finally(() => {
      Building.removeOverride(overrideId);
    });
  };

  return { placeBuilding, destroyBuilding };
}
