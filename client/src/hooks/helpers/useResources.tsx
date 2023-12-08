import { Has, HasValue, NotValue, getComponentValue } from "@latticexyz/recs";
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
      components: { Inventory, ForeignKey, ResourceChest, DetachedResource, Resource },
      optimisticSystemCalls: { optimisticOffloadResources },
      systemCalls: { transfer_items },
    },
  } = useDojo();

  // for any entity that has a resourceChest in its inventory,
  const getResourcesFromInventory = (entityId: number): { resources: Resource[]; indices: number[] } => {
    let indices: number[] = [];
    let resources: Record<number, number> = {};
    let inventory = getComponentValue(Inventory, getEntityIdFromKeys([BigInt(entityId)]));

    if (!inventory) {
      return { resources: [], indices: [] };
    }

    for (let i = 0; i < inventory.items_count; i++) {
      let foreignKey = inventory
        ? getComponentValue(ForeignKey, getEntityIdFromKeys([BigInt(entityId), BigInt(inventory.items_key), BigInt(i)]))
        : undefined;

      // if nothing on this index, break
      let resourcesChest = foreignKey
        ? getComponentValue(ResourceChest, getEntityIdFromKeys([BigInt(foreignKey.entity_id)]))
        : undefined;

      if (resourcesChest && foreignKey) {
        let { resources_count } = resourcesChest;
        for (let i = 0; i < resources_count; i++) {
          let entityId = getEntityIdFromKeys([BigInt(foreignKey.entity_id), BigInt(i)]);
          const resource = getComponentValue(DetachedResource, entityId);
          if (resource) {
            resources[resource.resource_type] = (resources[resource.resource_type] || 0) + resource.resource_amount;
          }
        }
      }
      indices.push(i);
    }

    return {
      resources: Object.keys(resources).map((resourceId: string) => ({
        resourceId: Number(resourceId),
        amount: resources[Number(resourceId)],
      })),
      indices,
    };
  };

  const getResourceChestIdFromInventoryIndex = (entityId: number, index: number): number | undefined => {
    let inventory = getComponentValue(Inventory, getEntityIdFromKeys([BigInt(entityId)]));
    let foreignKey = inventory
      ? getComponentValue(
          ForeignKey,
          getEntityIdFromKeys([BigInt(entityId), BigInt(inventory.items_key), BigInt(index)]),
        )
      : undefined;

    return foreignKey?.entity_id;
  };

  const getFoodResources = (entityId: number): Resource[] => {
    const wheat = getComponentValue(Resource, getEntityIdFromKeys([BigInt(entityId), BigInt(254)]));
    const fish = getComponentValue(Resource, getEntityIdFromKeys([BigInt(entityId), BigInt(255)]));

    return [
      {
        resourceId: 254,
        amount: wheat?.balance || 0,
      },
      { resourceId: 255, amount: fish?.balance || 0 },
    ];
  };

  /* Empty Resource Chest
   * @param receiver_id: entity id of entity that will add resources to balance
   * @param carrier_id: id of the entity that carries the resource chest
   * @param resources_chest_id: id of the resources chest
   * @param [optimisticResourcesGet]: resources to display in case of optimistic rendering
   * @returns: void
   */
  const offloadChests = async (
    receiving_entity_id: BigNumberish,
    transport_id: BigNumberish,
    entity_index_in_inventory: BigNumberish[],
    optimisticResourcesGet?: Resource[],
  ) => {
    if (optimisticResourcesGet) {
      return await optimisticOffloadResources(
        optimisticResourcesGet,
        transfer_items,
      )({
        signer: account,
        receiver_id: receiving_entity_id,
        sender_id: transport_id,
        indices: entity_index_in_inventory,
      });
    }
    return await transfer_items({
      signer: account,
      sender_id: transport_id,
      receiver_id: receiving_entity_id,
      indices: entity_index_in_inventory,
    });
  };

  return { getResourcesFromInventory, offloadChests, getFoodResources, getResourceChestIdFromInventoryIndex };
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
    NotValue(Inventory, {
      items_count: 0,
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
