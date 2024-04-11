import { type Entity, Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys, getForeignKeyEntityId } from "../../ui/utils/utils";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { type BigNumberish } from "starknet";
import { type Resource } from "@bibliothecadao/eternum";
import { EventType, useNotificationsStore } from "../store/useNotificationsStore";
import { ProductionManager } from "../../dojo/modelManager/ProductionManager";
import { useEffect, useState } from "react";
import useBlockchainStore from "../store/useBlockchainStore";

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
        Production,
      },
      optimisticSystemCalls: { optimisticOffloadResources },
      systemCalls: { transfer_items },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const deleteNotification = useNotificationsStore((state) => state.deleteNotification);

  // for any entity that has a resourceChest in its inventory,
  const getResourcesFromInventory = (entityId: bigint): { resources: Resource[]; indices: number[] } => {
    const indices: number[] = [];
    const resources: Record<number, number> = {};
    const inventory = getComponentValue(Inventory, getEntityIdFromKeys([entityId]));

    if (!inventory) {
      return { resources: [], indices: [] };
    }

    // todo: switch back to items_count when working
    for (let i = 0; i < inventory.items_count; i++) {
      const foreignKey = inventory
        ? getComponentValue(ForeignKey, getForeignKeyEntityId(entityId, inventory.items_key, BigInt(i)))
        : undefined;

      // if nothing on this index, break
      const resourcesChest = foreignKey
        ? getComponentValue(ResourceChest, getEntityIdFromKeys([foreignKey.entity_id]))
        : undefined;

      if (resourcesChest && foreignKey) {
        const { resources_count } = resourcesChest;
        for (let i = 0; i < resources_count; i++) {
          const entityId = getEntityIdFromKeys([BigInt(foreignKey.entity_id), BigInt(i)]);
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
    const resources: Record<number, number> = {};

    // todo: switch back to items_count when working
    for (let i = 0; i < entityIds.length; i++) {
      const resourcesChest = getComponentValue(ResourceChest, getEntityIdFromKeys([entityIds[i]]));

      if (resourcesChest) {
        const { resources_count } = resourcesChest;
        for (let i = 0; i < resources_count; i++) {
          const entityId = getEntityIdFromKeys([entityIds[i], BigInt(i)]);
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
    const inventory = getComponentValue(Inventory, getEntityIdFromKeys([BigInt(entityId)]));
    const foreignKey = inventory
      ? getComponentValue(ForeignKey, getForeignKeyEntityId(entityId, inventory.items_key, BigInt(index)))
      : undefined;

    return foreignKey?.entity_id;
  };

  const getResourceCosts = (costUuid: bigint, count: number) => {
    const resourceCosts = [];
    for (let i = 0; i < count; i++) {
      const resourceCost = getComponentValue(ResourceCost, getEntityIdFromKeys([costUuid, BigInt(i)]));
      if (resourceCost) {
        resourceCosts.push({ resourceId: resourceCost.resource_type, amount: Number(resourceCost.amount) });
      }
    }
    return resourceCosts;
  };

  const getRealmsWithSpecificResource = (
    resourceId: number,
    minAmount: number,
  ): Array<{ realmEntityId: bigint; realmId: bigint; amount: number }> => {
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
      .filter(Boolean) as Array<{ realmEntityId: bigint; realmId: bigint; amount: number }>;

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
    getResourceChestIdFromInventoryIndex,
    getCaravansWithResourcesChest,
    getResourceCosts,
  };
}

export function useResourceBalance() {
  const {
    setup: {
      components: { Resource, Production },
    },
  } = useDojo();

  const currentTick = useBlockchainStore((state) => state.currentTick);

  const getFoodResources = (entityId: bigint): Resource[] => {
    const wheatBalance = new ProductionManager(Production, Resource, entityId, 254n).balance(currentTick);
    const fishBalance = new ProductionManager(Production, Resource, entityId, 255n).balance(currentTick);

    return [
      { resourceId: 254, amount: wheatBalance },
      { resourceId: 255, amount: fishBalance },
    ];
  };

  const getBalance = (entityId: bigint, resourceId: number) => {
    const productionManager = new ProductionManager(Production, Resource, entityId, BigInt(resourceId));
    return { balance: productionManager.balance(currentTick), resourceId };
  };

  const getProductionManager = (entityId: bigint, resourceId: number): ProductionManager => {
    return new ProductionManager(Production, Resource, entityId, BigInt(resourceId));
  };

  const useBalance = (entityId: bigint, resourceId: number) => {
    const [resourceBalance, setResourceBalance] = useState<Resource>({ amount: 0, resourceId });

    const resource = getComponentValue(Resource, getEntityIdFromKeys([entityId, BigInt(resourceId)]));
    const production = getComponentValue(Production, getEntityIdFromKeys([entityId, BigInt(resourceId)]));

    useEffect(() => {
      const productionManager = new ProductionManager(Production, Resource, entityId, BigInt(resourceId));
      setResourceBalance({ amount: productionManager.balance(currentTick), resourceId });
    }, [resource, production]);

    return resourceBalance;
  };

  return {
    getFoodResources,
    getBalance,
    useBalance,
    getProductionManager,
  };
}
