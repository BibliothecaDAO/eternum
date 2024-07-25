import { Position, ResourcesIds, resources, type Resource } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, Not, NotValue, getComponentValue, runQuery, type Entity } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";
import { ProductionManager } from "../../dojo/modelManager/ProductionManager";
import { getEntityIdFromKeys } from "../../ui/utils/utils";
import { useDojo } from "../context/DojoContext";
import useBlockchainStore from "../store/useBlockchainStore";

export function useResources() {
  const {
    account: { account },
    setup: {
      components: { Resource, Position, ResourceCost, Realm, EntityOwner, ArrivalTime, OwnedResourcesTracker, Owner },
    },
  } = useDojo();

  const getResourcesFromBalance = (entityId: bigint): Resource[] => {
    // todo: switch back to items_count when working
    const ownedResources = getComponentValue(OwnedResourcesTracker, getEntityIdFromKeys([entityId]));
    if (!ownedResources) return [];
    // const resourceIds = getResourceIdsFromPackedNumber(ownedResources.resource_types);
    const resourceIds = resources.map((r) => r.id);
    return resourceIds
      .map((id) => {
        const resource = getComponentValue(Resource, getEntityIdFromKeys([entityId, BigInt(id)]));
        return { resourceId: id, amount: Number(resource?.balance) || 0 };
      })
      .filter((r) => r.amount > 0);
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

  const atPositionWithInventory = useEntityQuery([
    Has(EntityOwner),
    NotValue(OwnedResourcesTracker, { resource_types: 0n }),
    Has(ArrivalTime),
  ]);

  const getArrivalsWithResources = useMemo(() => {
    return (entityId: bigint) => {
      const entityPosition = getComponentValue(Position, getEntityIdFromKeys([entityId]));

      if (!entityPosition) {
        return [];
      }

      return atPositionWithInventory
        .filter((id) => {
          const position = getComponentValue(Position, id);
          return position?.x === entityPosition.x && position?.y === entityPosition.y;
        })
        .map((id) => getComponentValue(Position, id)?.entity_id)
        .filter(Boolean) as bigint[];
    };
  }, [atPositionWithInventory]);

  // Get all owned entities with resources
  const getAllArrivalsWithResources = useMemo(() => {
    const currentTime = Date.now();

    type ArrivalInfo = {
      id: Entity;
      entityId: bigint;
      arrivesAt: number;
      isOwner: boolean;
    };

    return atPositionWithInventory
      .map((id) => {
        const entityOwner = getComponentValue(EntityOwner, id);
        const owner = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || BigInt(0)]));
        const arrivalTime = getComponentValue(ArrivalTime, id);
        const position = getComponentValue(Position, id);
        return {
          id,
          entityId: position?.entity_id || BigInt(""),
          arrivesAt: Number(arrivalTime?.arrives_at || 0),
          isOwner: BigInt(owner?.address || "") === BigInt(account.address),
        };
      })
      .filter((val: ArrivalInfo | undefined): val is ArrivalInfo => val !== undefined)
      .filter(({ isOwner, arrivesAt }) => isOwner && arrivesAt <= currentTime)
      .sort((a, b) => a.arrivesAt - b.arrivesAt)
      .map(({ entityId }) => entityId)
      .filter((entityId) => entityId !== BigInt(""));
  }, [atPositionWithInventory, account.address]);

  return {
    getRealmsWithSpecificResource,
    getResourcesFromBalance,
    getArrivalsWithResources,
    getAllArrivalsWithResources,
    getResourceCosts,
  };
}

export function useResourceBalance() {
  const {
    setup: {
      components: { Resource, Production, BuildingQuantityv2, DetachedResource },
    },
  } = useDojo();

  const getFoodResources = (entityId: bigint): Resource[] => {
    const currentDefaultTick = useBlockchainStore.getState().currentDefaultTick;
    const wheatBalance = new ProductionManager(
      Production,
      Resource,
      BuildingQuantityv2,
      entityId,
      BigInt(ResourcesIds.Wheat),
    ).balance(currentDefaultTick);
    const fishBalance = new ProductionManager(
      Production,
      Resource,
      BuildingQuantityv2,
      entityId,
      BigInt(ResourcesIds.Fish),
    ).balance(currentDefaultTick);

    return [
      { resourceId: ResourcesIds.Wheat, amount: wheatBalance },
      { resourceId: ResourcesIds.Fish, amount: fishBalance },
    ];
  };

  const getResourceProductionInfo = (entityId: bigint, resourceId: number) => {
    const productionManager = new ProductionManager(
      Production,
      Resource,
      BuildingQuantityv2,
      entityId,
      BigInt(resourceId),
    );
    return productionManager.getProduction();
  };

  const getBalance = (entityId: bigint, resourceId: number) => {
    const currentDefaultTick = useBlockchainStore.getState().currentDefaultTick;
    const productionManager = new ProductionManager(
      Production,
      Resource,
      BuildingQuantityv2,
      entityId,
      BigInt(resourceId),
    );
    return { balance: productionManager.balance(currentDefaultTick), resourceId };
  };

  const getResourceBalance = (entityId: bigint) => {
    const detachedResourceEntityIds = runQuery([HasValue(DetachedResource, { entity_id: entityId })]);
    return Array.from(detachedResourceEntityIds).map((entityId) => getComponentValue(DetachedResource, entityId));
  };

  // We should deprecate this hook and use getBalance instead - too many useEffects
  const useBalance = (entityId: bigint, resourceId: number) => {
    const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);
    const [resourceBalance, setResourceBalance] = useState<Resource>({ amount: 0, resourceId });

    useEffect(() => {
      const productionManager = new ProductionManager(
        Production,
        Resource,
        BuildingQuantityv2,
        entityId,
        BigInt(resourceId),
      );
      setResourceBalance({ amount: productionManager.balance(currentDefaultTick), resourceId });
    }, []);

    return resourceBalance;
  };

  return {
    getFoodResources,
    getBalance,
    useBalance,
    getResourceBalance,
    getResourceProductionInfo,
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

export function useOwnedEntitiesOnPosition() {
  const {
    account: { account },
    setup: {
      components: { Owner, Position, Movable, Bank, Army },
    },
  } = useDojo();

  const getOwnedEntitiesOnPosition = (address: bigint, position: Position) => {
    const { x, y } = position;

    const entities = runQuery([
      HasValue(Owner, { address }),
      Not(Movable),
      Not(Army),
      // don't want bank but bank accounts
      Not(Bank),
      // @note: safer to do like this rather than deconstruct because there's a chance entity_id is also there
      HasValue(Position, { x, y }),
    ]);

    return Array.from(entities)
      .map((entityId) => {
        const position = getComponentValue(Position, entityId);
        if (!position) return;
        return position?.entity_id;
      })
      .filter(Boolean) as bigint[];
  };

  const getOwnedEntityOnPosition = (entityId: bigint) => {
    const position = getComponentValue(Position, getEntityIdFromKeys([entityId]));
    const depositEntityIds = position
      ? getOwnedEntitiesOnPosition(BigInt(account.address), { x: Number(position.x), y: Number(position.y) })
      : [];
    return depositEntityIds[0];
  };

  return {
    getOwnedEntitiesOnPosition,
    getOwnedEntityOnPosition,
  };
}
