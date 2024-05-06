import {
  type Entity,
  Has,
  HasValue,
  NotValue,
  getComponentValue,
  runQuery,
  Not,
  getEntitiesWithValue,
} from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { getEntityIdFromKeys, getResourceIdsFromPackedNumber } from "../../ui/utils/utils";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { Position, ResourcesIds, type Resource } from "@bibliothecadao/eternum";
import { ProductionManager } from "../../dojo/modelManager/ProductionManager";
import { useEffect, useMemo, useState } from "react";
import useBlockchainStore from "../store/useBlockchainStore";

export function useResources() {
  const {
    account: { account },
    setup: {
      components: { Resource, Position, ResourceCost, Realm, EntityOwner, ArrivalTime, OwnedResourcesTracker },
    },
  } = useDojo();

  const getResourcesFromBalance = (entityId: bigint): Resource[] => {
    // todo: switch back to items_count when working
    const ownedResources = getComponentValue(OwnedResourcesTracker, getEntityIdFromKeys([entityId]));
    if (!ownedResources) return [];
    const resourceIds = getResourceIdsFromPackedNumber(ownedResources.resource_types);
    return resourceIds.map((id) => {
      const resource = getComponentValue(Resource, getEntityIdFromKeys([entityId, BigInt(id)]));
      return { resourceId: id, amount: Number(resource?.balance) || 0 };
    });
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

  const getArrivalsWithResources = (entityId: bigint) => {
    const entityPosition = getComponentValue(Position, getEntityIdFromKeys([entityId]));

    const entititsAtPositionWithInventory = useEntityQuery([
      Has(EntityOwner),
      NotValue(OwnedResourcesTracker, { resource_types: 0n }),
      HasValue(Position, {
        x: entityPosition?.x,
        y: entityPosition?.y,
      }),
      Has(ArrivalTime),
    ]);

    return entititsAtPositionWithInventory.map((id) => {
      const position = getComponentValue(Position, id);
      return position!.entity_id;
    });
  };

  return {
    getRealmsWithSpecificResource,
    getResourcesFromBalance,
    getArrivalsWithResources,
    getResourceCosts,
  };
}

export function useResourceBalance() {
  const {
    setup: {
      components: { Resource, Production, QuantityTracker, BuildingQuantityv2 },
    },
  } = useDojo();

  const currentTick = useBlockchainStore((state) => state.currentTick);

  const getFoodResources = (entityId: bigint): Resource[] => {
    const wheatBalance = new ProductionManager(
      Production,
      Resource,
      BuildingQuantityv2,
      entityId,
      BigInt(ResourcesIds.Wheat),
    ).balance(currentTick);
    const fishBalance = new ProductionManager(
      Production,
      Resource,
      BuildingQuantityv2,
      entityId,
      BigInt(ResourcesIds.Fish),
    ).balance(currentTick);

    return [
      { resourceId: ResourcesIds.Wheat, amount: wheatBalance },
      { resourceId: ResourcesIds.Fish, amount: fishBalance },
    ];
  };

  const getBalance = (entityId: bigint, resourceId: number) => {
    const productionManager = new ProductionManager(
      Production,
      Resource,
      BuildingQuantityv2,
      entityId,
      BigInt(resourceId),
    );
    return { balance: productionManager.balance(currentTick), resourceId };
  };

  // We should deprecate this hook and use getBalance instead - too many useEffects
  const useBalance = (entityId: bigint, resourceId: number) => {
    const [resourceBalance, setResourceBalance] = useState<Resource>({ amount: 0, resourceId });

    const resource = getComponentValue(Resource, getEntityIdFromKeys([entityId, BigInt(resourceId)]));
    const production = getComponentValue(Production, getEntityIdFromKeys([entityId, BigInt(resourceId)]));

    useEffect(() => {
      const productionManager = new ProductionManager(
        Production,
        Resource,
        BuildingQuantityv2,
        entityId,
        BigInt(resourceId),
      );
      setResourceBalance({ amount: productionManager.balance(currentTick), resourceId });
    }, []);

    return resourceBalance;
  };

  return {
    getFoodResources,
    getBalance,
    useBalance,
  };
}

export const useProductionManager = (entityId: bigint, resourceId: number) => {
  const {
    setup: {
      components: { Resource, Production, BuildingQuantityv2 },
    },
  } = useDojo();

  const production = useComponentValue(Production, getEntityIdFromKeys([entityId, BigInt(resourceId)]));

  const productionManager = useMemo(() => {
    return new ProductionManager(Production, Resource, BuildingQuantityv2, entityId, BigInt(resourceId));
  }, [Production, Resource, entityId, resourceId, production]);

  return productionManager;
};

export const useGetBankAccountOnPosition = (address: bigint, position: Position) => {
  const {
    setup: {
      components: { Owner, Position, Movable, Bank, Realm },
    },
  } = useDojo();

  const entities = runQuery([
    HasValue(Owner, { address }),
    Not(Movable),
    Not(Bank),
    Not(Realm),
    HasValue(Position, { ...position }),
  ]);

  return Array.from(entities)
    .map((entityId) => {
      const position = getComponentValue(Position, entityId);
      if (!position) return;
      return position?.entity_id;
    })
    .filter(Boolean) as bigint[];
};

export const useGetOwnedEntityOnPosition = (address: bigint, position: Position) => {
  const {
    setup: {
      components: { Owner, Position, Movable, Bank, Realm },
    },
  } = useDojo();

  const entities = runQuery([
    HasValue(Owner, { address }),
    Not(Movable),
    // don't want bank but bank accounts
    Not(Bank),
    HasValue(Position, { ...position }),
  ]);

  return Array.from(entities)
    .map((entityId) => {
      const position = getComponentValue(Position, entityId);
      if (!position) return;
      return position?.entity_id;
    })
    .filter(Boolean) as bigint[];
};
