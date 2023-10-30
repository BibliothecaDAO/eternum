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
      components: { Inventory, ForeignKey, ResourceChest, DetachedResource },
      optimisticSystemCalls: { optimisticOffloadResources },
      systemCalls: { offload_chest },
    },
  } = useDojo();

  // for any entity that has a resourceChest in its inventory,
  const getResourcesFromInventory = (entityId: number): Resource[] => {
    let inventory = getComponentValue(Inventory, getEntityIdFromKeys([BigInt(entityId)]));
    let foreignKey = inventory
      ? getComponentValue(ForeignKey, getEntityIdFromKeys([BigInt(entityId), BigInt(inventory.items_key), BigInt(0)]))
      : undefined;

    let resourcesChest = foreignKey
      ? getComponentValue(ResourceChest, getEntityIdFromKeys([BigInt(foreignKey.entity_id)]))
      : undefined;

    if (!resourcesChest) return [];
    let resources: Resource[] = [];
    let { resources_count } = resourcesChest;
    for (let i = 0; i < resources_count; i++) {
      let entityId = getEntityIdFromKeys([BigInt(foreignKey.entity_id), BigInt(i)]);
      const resource = getComponentValue(DetachedResource, entityId);
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
   * @param receiver_id: entity id of entity that will add resources to balance
   * @param carrier_id: id of the entity that carries the resource chest
   * @param resources_chest_id: id of the resources chest
   * @param [optimisticResourcesGet]: resources to display in case of optimistic rendering
   * @returns: void
   */
  const offloadChest = async (
    receiving_entity_id: BigNumberish,
    transport_id: BigNumberish,
    resource_chest_id: BigNumberish,
    entity_index_in_inventory: BigNumberish,
    optimisticResourcesGet?: Resource[],
  ) => {
    if (optimisticResourcesGet) {
      return await optimisticOffloadResources(
        optimisticResourcesGet,
        offload_chest,
      )({
        signer: account,
        receiving_entity_id,
        transport_id,
        entity_id: resource_chest_id,
        entity_index_in_inventory,
      });
    }
    return await offload_chest({
      signer: account,
      receiving_entity_id,
      transport_id,
      entity_id: resource_chest_id,
      entity_index_in_inventory,
    });
  };

  return { getResourcesFromInventory, offloadChest };
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
      items_count: 1,
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
