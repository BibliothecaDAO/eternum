import { BuildingType } from "@bibliothecadao/eternum";
import { useDojo } from "../context/DojoContext";
import { CairoOption, CairoOptionVariant } from "starknet";

export function useBuildings() {
  const {
    account: { account },
    setup: {
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
    });
  };

  const destroyBuilding = async (realmEntityId: bigint, col: number, row: number) => {
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
