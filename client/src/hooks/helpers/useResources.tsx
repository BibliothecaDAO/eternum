import { Has, HasValue, getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "../../utils/utils";
import { useEntityQuery } from "@dojoengine/react";
import { BigNumberish } from "starknet";
import { Resource } from "../../types";

export function useResources() {
  const {
    account: { account },
    setup: {
      components: { Inventory, ForeignKey, ResourcesChest, ResourceDetached },
      optimisticSystemCalls: { optimisticEmptyResourcesChest },
      systemCalls: { empty_resources_chest },
    },
  } = useDojo();

  // for any entity that has a resourceChest in its inventory,
  const getResourcesChestFromInventory = (entityId: number): Resource[] => {
    let inventory = getComponentValue(Inventory, getEntityIdFromKeys([BigInt(entityId)]));
    let foreignKey = inventory
      ? getComponentValue(ForeignKey, getEntityIdFromKeys([BigInt(inventory.key), BigInt(0)]))
      : undefined;
    let resourcesChest = foreignKey
      ? getComponentValue(ResourcesChest, getEntityIdFromKeys([BigInt(foreignKey.entity_id)]))
      : undefined;

    if (!resourcesChest) return [];
    let resources: Resource[] = [];
    let { resources_count } = resourcesChest;
    for (let i = 0; i < resources_count; i++) {
      let entityId = getEntityIdFromKeys([BigInt(foreignKey.entity_id), BigInt(i)]);
      const resource = getComponentValue(ResourceDetached, entityId);
      if (resource) {
        resources.push({
          resourceId: resource.resource_type,
          amount: resource.resource_amount,
        });
      }
    }
    return resources;
  };

  /* Empty Resource Chest
   * @param entity_id: entity id of realm
   * @param trade_id: id of the trade
   * @param [optimisticResourcesGet]: resources to display in case of optimistic rendering
   * @returns: void
   */
  const emptyResourceChest = async (
    receiver_id: BigNumberish,
    carrier_id: BigNumberish,
    resources_chest_id: BigNumberish,
    optimisticResourcesGet?: Resource[],
  ) => {
    if (optimisticResourcesGet) {
      return await optimisticEmptyResourcesChest(
        optimisticResourcesGet,
        empty_resources_chest,
      )({
        signer: account,
        receiver_id,
        carrier_id,
        resources_chest_id,
      });
    }
    return await empty_resources_chest({
      signer: account,
      receiver_id,
      carrier_id,
      resources_chest_id,
    });
  };

  return { getResourcesChestFromInventory, emptyResourceChest };
}

//  caravans coming your way with a resource chest in their inventory
export function useGetCaravansWithResourcesChest() {
  const {
    setup: {
      components: { Position, CaravanMembers, Inventory },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();
  const realmPosition = getComponentValue(Position, getEntityIdFromKeys([BigInt(realmEntityId)]));

  const caravansAtPositionWithInventory = useEntityQuery([
    Has(CaravanMembers),
    HasValue(Inventory, {
      count: 1,
    }),
    HasValue(Position, {
      x: realmPosition?.x,
      y: realmPosition?.y,
    }),
  ]);

  return {
    caravansAtPositionWithInventory,
  };
}
