import { Entity, Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys, getForeignKeyEntityId } from "../../utils/utils";
import { useEntityQuery } from "@dojoengine/react";
import { BigNumberish } from "starknet";
import { Resource } from "@bibliothecadao/eternum";
import { EventType, useNotificationsStore } from "../store/useNotificationsStore";

export function useResources() {
  const {
    account: { account },
    setup: {
      components: {
        Inventory,
        ForeignKey,
        ResourceChest,
        DetachedResource,
        Resource,
        CaravanMembers,
        Position,
        ResourceCost,
        Realm,
      },
      optimisticSystemCalls: { optimisticOffloadResources },
      systemCalls: { transfer_items },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const deleteNotification = useNotificationsStore((state) => state.deleteNotification);

  // for any entity that has a resourceChest in its inventory,
  const getResourcesFromInventory = (entityId: bigint): { resources: Resource[]; indices: number[] } => {
    let indices: number[] = [];
    let resources: Record<number, number> = {};
    let inventory = getComponentValue(Inventory, getEntityIdFromKeys([entityId]));

    if (!inventory) {
      return { resources: [], indices: [] };
    }

    // todo: switch back to items_count when working
    for (let i = 0; i < inventory.items_count; i++) {
      let foreignKey = inventory
        ? getComponentValue(ForeignKey, getForeignKeyEntityId(entityId, inventory.items_key, BigInt(i)))
        : undefined;

      // if nothing on this index, break
      let resourcesChest = foreignKey
        ? getComponentValue(ResourceChest, getEntityIdFromKeys([foreignKey.entity_id]))
        : undefined;

      if (resourcesChest && foreignKey) {
        let { resources_count } = resourcesChest;
        for (let i = 0; i < resources_count; i++) {
          let entityId = getEntityIdFromKeys([BigInt(foreignKey.entity_id), BigInt(i)]);
          const resource = getComponentValue(DetachedResource, entityId);
          if (resource) {
            resources[resource.resource_type] =
              (resources[resource.resource_type] || 0) + Number(resource.resource_amount);
          }
        }
      }
      if (!resourcesChest) {
        break;
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

  const getResourcesFromResourceChestIds = (entityIds: bigint[]): Resource[] => {
    let resources: Record<number, number> = {};

    // todo: switch back to items_count when working
    for (let i = 0; i < entityIds.length; i++) {
      let resourcesChest = getComponentValue(ResourceChest, getEntityIdFromKeys([entityIds[i]]));

      if (resourcesChest) {
        let { resources_count } = resourcesChest;
        for (let i = 0; i < resources_count; i++) {
          let entityId = getEntityIdFromKeys([entityIds[i], BigInt(i)]);
          const resource = getComponentValue(DetachedResource, entityId);
          if (resource) {
            resources[resource.resource_type] =
              (resources[resource.resource_type] || 0) + Number(resource.resource_amount);
          }
        }
      }
      if (!resourcesChest) {
        break;
      }
    }

    return Object.keys(resources).map((resourceId: string) => ({
      resourceId: Number(resourceId),
      amount: resources[Number(resourceId)],
    }));
  };

  const getResourceChestIdFromInventoryIndex = (entityId: bigint, index: number): bigint | undefined => {
    let inventory = getComponentValue(Inventory, getEntityIdFromKeys([BigInt(entityId)]));
    let foreignKey = inventory
      ? getComponentValue(ForeignKey, getForeignKeyEntityId(entityId, inventory.items_key, BigInt(index)))
      : undefined;

    return foreignKey?.entity_id;
  };

  const getResourceCosts = (costUuid: bigint, count: number) => {
    let resourceCosts = [];
    for (let i = 0; i < count; i++) {
      let resourceCost = getComponentValue(ResourceCost, getEntityIdFromKeys([costUuid, BigInt(i)]));
      if (resourceCost) {
        resourceCosts.push({ resourceId: resourceCost.resource_type, amount: Number(resourceCost.amount) });
      }
    }
    return resourceCosts;
  };

  const getFoodResources = (entityId: bigint): Resource[] => {
    const wheat = getComponentValue(Resource, getEntityIdFromKeys([entityId, 254n]));
    const fish = getComponentValue(Resource, getEntityIdFromKeys([entityId, 255n]));

    return [
      {
        resourceId: 254,
        amount: Number(wheat?.balance) || 0,
      },
      { resourceId: 255, amount: Number(fish?.balance) || 0 },
    ];
  };

  const getBalance = (
    realmEntityId: bigint,
    resourceId: number,
  ): { resource_type: number; balance: number } | undefined => {
    let resource = getComponentValue(Resource, getEntityIdFromKeys([realmEntityId, BigInt(resourceId)]));
    if (resource) {
      return {
        resource_type: resource.resource_type,
        balance: Number(resource.balance),
      };
    }
  };

  const getRealmsWithSpecificResource = (
    resourceId: number,
    minAmount: number,
  ): { realmEntityId: bigint; realmId: bigint; amount: number }[] => {
    const allRealms = Array.from(runQuery([Has(Realm)]));

    const realmsWithResource = allRealms
      .map((id: Entity) => {
        const realm = getComponentValue(Realm, id);
        const resource = realm
          ? getComponentValue(Resource, getEntityIdFromKeys([realm?.entity_id, BigInt(resourceId)]))
          : undefined;

        if (resource && resource.balance > minAmount) {
          return {
            realmEntityId: realm?.entity_id,
            realmId: realm?.realm_id,
            amount: Number(resource.balance),
          };
        }
      })
      .filter(Boolean) as { realmEntityId: bigint; realmId: bigint; amount: number }[];

    return realmsWithResource;
  };

  //  caravans coming your way with a resource chest in their inventory
  const getCaravansWithResourcesChest = () => {
    const realmPosition = getComponentValue(Position, getEntityIdFromKeys([realmEntityId]));

    const caravansAtPositionWithInventory = useEntityQuery([
      Has(CaravanMembers),
      NotValue(Inventory, {
        items_count: 0n,
      }),
      HasValue(Position, {
        x: realmPosition?.x,
        y: realmPosition?.y,
      }),
    ]);

    return caravansAtPositionWithInventory.map((id) => {
      const caravanMembers = getComponentValue(CaravanMembers, id);
      return caravanMembers!.entity_id;
    });
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
      await optimisticOffloadResources(
        optimisticResourcesGet,
        transfer_items,
      )({
        signer: account,
        receiver_id: receiving_entity_id,
        sender_id: transport_id,
        indices: entity_index_in_inventory,
      });
    } else {
      await transfer_items({
        signer: account,
        sender_id: transport_id,
        receiver_id: receiving_entity_id,
        indices: entity_index_in_inventory,
      });
    }
    deleteNotification([transport_id.toString()], EventType.EmptyChest);
  };

  return {
    getRealmsWithSpecificResource,
    getResourcesFromInventory,
    getResourcesFromResourceChestIds,
    offloadChests,
    getFoodResources,
    getResourceChestIdFromInventoryIndex,
    getBalance,
    getCaravansWithResourcesChest,
    getResourceCosts,
  };
}
