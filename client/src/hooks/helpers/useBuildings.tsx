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

  const placeBuilding = async (
    realmEntityId: bigint,
    col: number,
    row: number,
    buildingType: BuildingType,
    resourceType?: number,
  ) => {
    // add optimisitc rendering
    const realmPosition = getComponentValue(Position, getEntityIdFromKeys([realmEntityId]));
    if (!realmPosition) return;
    const { x: outercol, y: outerrow } = realmPosition;
    const category = BuildingType[buildingType];
    const entity = getEntityIdFromKeys([outercol, outerrow, col, row].map((v) => BigInt(v)));
    const overrideId = uuid();
    Building.addOverride(overrideId, {
      entity,
      value: {
        outer_col: BigInt(outercol),
        outer_row: BigInt(outerrow),
        inner_col: BigInt(col),
        inner_row: BigInt(row),
        category,
        produced_resource_type: resourceType ? resourceType : 0,
      },
    });

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
    }).catch(() => {
      Building.removeOverride(overrideId);
    });
  };

  const destroyBuilding = async (realmEntityId: bigint, col: number, row: number) => {
    // add optimisitc rendering
    await destroy_building({
      signer: account,
      entity_id: realmEntityId as bigint,
      building_coord: {
        x: col.toString(),
        y: row.toString(),
      },
    });
  };

  return { placeBuilding, destroyBuilding };
}
