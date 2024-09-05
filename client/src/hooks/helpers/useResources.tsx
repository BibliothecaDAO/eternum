import { ContractAddress, ID, Position, ResourcesIds, resources, type Resource } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, Not, NotValue, getComponentValue, runQuery, type Entity } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";
import { ProductionManager } from "../../dojo/modelManager/ProductionManager";
import { getEntityIdFromKeys } from "../../ui/utils/utils";
import { useDojo } from "../context/DojoContext";
import useUIStore from "../store/useUIStore";

export function getResourcesUtils() {
  const {
    setup: {
      components: { Resource, ResourceCost, Realm, OwnedResourcesTracker },
    },
  } = useDojo();

  const getResourcesFromBalance = (entityId: ID): Resource[] => {
    // todo: switch back to items_count when working
    const ownedResources = getComponentValue(OwnedResourcesTracker, getEntityIdFromKeys([BigInt(entityId)]));
    if (!ownedResources) return [];
    // const resourceIds = getResourceIdsFromPackedNumber(ownedResources.resource_types);
    const resourceIds = resources.map((r) => r.id);
    return resourceIds
      .map((id) => {
        const resource = getComponentValue(Resource, getEntityIdFromKeys([BigInt(entityId), BigInt(id)]));
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
    resourceId: ResourcesIds,
    minAmount: number,
  ): Array<{ realmEntityId: ID; realmId: ID; amount: number }> => {
    const allRealms = Array.from(runQuery([Has(Realm)]));

    const realmsWithResource = allRealms
      .map((id: Entity) => {
        const realm = getComponentValue(Realm, id);
        const resource = realm
          ? getComponentValue(Resource, getEntityIdFromKeys([BigInt(realm?.entity_id), BigInt(resourceId)]))
          : undefined;

        if (resource && resource.balance > minAmount) {
          return {
            realmEntityId: realm?.entity_id,
            realmId: realm?.realm_id,
            amount: Number(resource.balance),
          };
        }
      })
      .filter(Boolean) as Array<{ realmEntityId: ID; realmId: ID; amount: number }>;

    return realmsWithResource;
  };

  return {
    getRealmsWithSpecificResource,
    getResourcesFromBalance,
    getResourceCosts,
  };
}

export const useArrivalsWithResources = () => {
  const {
    account: { account },
    setup: {
      components: { Position, Owner, EntityOwner, ArrivalTime, OwnedResourcesTracker, Weight },
    },
  } = useDojo();

  const atPositionWithInventory = useEntityQuery([
    Has(EntityOwner),
    NotValue(OwnedResourcesTracker, { resource_types: 0n }),
    Has(Weight),
    Has(ArrivalTime),
  ]);

  // Get all owned entities with resources
  const getAllArrivalsWithResources = useMemo(() => {
    const currentTime = Date.now();

    type ArrivalInfo = {
      id: Entity;
      entityId: ID;
      arrivesAt: bigint;
      isOwner: boolean;
    };

    return atPositionWithInventory
      .map((id) => {
        const entityOwner = getComponentValue(EntityOwner, id);
        const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));
        const arrivalTime = getComponentValue(ArrivalTime, id);
        const position = getComponentValue(Position, id);
        return {
          id,
          entityId: position?.entity_id || 0,
          arrivesAt: arrivalTime?.arrives_at || 0n,
          isOwner: ContractAddress(owner?.address || 0n) === ContractAddress(account.address),
        };
      })
      .filter((val: ArrivalInfo | undefined): val is ArrivalInfo => val !== undefined)
      .filter(({ isOwner, arrivesAt }) => isOwner && arrivesAt <= currentTime)
      .sort((a, b) => Number(a.arrivesAt) - Number(b.arrivesAt))
      .map(({ entityId }) => entityId)
      .filter((entityId) => entityId !== 0);
  }, [atPositionWithInventory, account.address]);

  return {
    getAllArrivalsWithResources,
  };
};

export function getResourceBalance() {
  const dojo = useDojo();

  const getFoodResources = (entityId: ID): Resource[] => {
    const currentDefaultTick = useUIStore.getState().currentDefaultTick;
    const wheatBalance = new ProductionManager(dojo.setup, entityId, ResourcesIds.Wheat).balance(currentDefaultTick);
    const fishBalance = new ProductionManager(dojo.setup, entityId, ResourcesIds.Fish).balance(currentDefaultTick);

    return [
      { resourceId: ResourcesIds.Wheat, amount: wheatBalance },
      { resourceId: ResourcesIds.Fish, amount: fishBalance },
    ];
  };

  const getResourceProductionInfo = (entityId: ID, resourceId: ResourcesIds) => {
    const productionManager = new ProductionManager(dojo.setup, entityId, resourceId);
    return productionManager.getProduction();
  };

  const getBalance = (entityId: ID, resourceId: ResourcesIds) => {
    const currentDefaultTick = useUIStore.getState().currentDefaultTick;
    const productionManager = new ProductionManager(dojo.setup, entityId, resourceId);
    return { balance: productionManager.balance(currentDefaultTick), resourceId };
  };

  const getResourcesBalance = (entityId: ID) => {
    const detachedResourceEntityIds = runQuery([
      HasValue(dojo.setup.components.DetachedResource, { entity_id: entityId }),
    ]);
    return Array.from(detachedResourceEntityIds).map((entityId) =>
      getComponentValue(dojo.setup.components.DetachedResource, entityId),
    );
  };

  // We should deprecate this hook and use getBalance instead - too many useEffects
  const useBalance = (entityId: ID, resourceId: ResourcesIds) => {
    const currentDefaultTick = useUIStore.getState().currentDefaultTick;
    const [resourceBalance, setResourceBalance] = useState<Resource>({ amount: 0, resourceId });

    useEffect(() => {
      const productionManager = new ProductionManager(dojo.setup, entityId, resourceId);
      setResourceBalance({ amount: productionManager.balance(currentDefaultTick), resourceId });
    }, []);

    return resourceBalance;
  };

  return {
    getFoodResources,
    getBalance,
    useBalance,
    getResourcesBalance,
    getResourceProductionInfo,
  };
}

export const useProductionManager = (entityId: ID, resourceId: ResourcesIds) => {
  const dojo = useDojo();
  const production = useComponentValue(
    dojo.setup.components.Production,
    getEntityIdFromKeys([BigInt(entityId), BigInt(resourceId)]),
  );

  const productionManager = useMemo(() => {
    return new ProductionManager(dojo.setup, entityId, resourceId);
  }, [dojo.setup, entityId, resourceId, production]);

  return productionManager;
};

export function useOwnedEntitiesOnPosition() {
  const {
    account: { account },
    setup: {
      components: { Owner, Position, Movable, Bank, Army },
    },
  } = useDojo();

  const getOwnedEntitiesOnPosition = (address: ContractAddress, position: Position) => {
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
      .filter(Boolean) as ID[];
  };

  const getOwnedEntityOnPosition = (entityId: ID) => {
    const position = getComponentValue(Position, getEntityIdFromKeys([BigInt(entityId)]));
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
