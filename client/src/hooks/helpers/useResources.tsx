import { ContractAddress, ID, Position, ResourcesIds, resources, type Resource } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import {
  Has,
  HasValue,
  Not,
  NotValue,
  defineQuery,
  getComponentValue,
  isComponentUpdate,
  runQuery,
  type Entity,
} from "@dojoengine/recs";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type ArrivalInfo = {
  entityId: ID;
  position: Position;
  arrivesAt: bigint;
  isOwner: boolean;
};

export const usePlayerArrivals = () => {
  const {
    account: { account },
    setup: {
      components: { Position, Owner, EntityOwner, ArrivalTime, OwnedResourcesTracker, Weight, Structure },
    },
  } = useDojo();

  // needed to query without playerStructures() from useEntities because of circular dependency
  const playerStructures = useEntityQuery([
    Has(Structure),
    HasValue(Owner, { address: ContractAddress(account.address) }),
  ]);

  useEffect(() => {
    const positions = playerStructures.map((entityId) => {
      const position = getComponentValue(Position, entityId);
      return { x: position?.x ?? 0, y: position?.y ?? 0 };
    });
    setPlayerStructurePositions(positions);
  }, [playerStructures, Position]);

  const [playerStructurePositions, setPlayerStructurePositions] = useState<Position[]>([]);

  const [entitiesWithInventory, setEntitiesWithInventory] = useState<ArrivalInfo[]>([]);

  const fragments = [NotValue(OwnedResourcesTracker, { resource_types: 0n }), Has(Weight), Has(ArrivalTime)];

  const getArrivalsWithResourceOnPosition = useCallback((positions: Position[]) => {
    return positions.flatMap((position) => {
      return Array.from(runQuery([HasValue(Position, { x: position.x, y: position.y }), ...fragments]));
    });
  }, []);

  const createArrivalInfo = useCallback(
    (id: Entity): ArrivalInfo | undefined => {
      const arrivalTime = getComponentValue(ArrivalTime, id);
      const entityOwner = getComponentValue(EntityOwner, id);
      const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));
      const position = getComponentValue(Position, id);

      if (!arrivalTime || !position || owner?.address !== ContractAddress(account.address)) {
        return undefined;
      }

      return {
        entityId: position.entity_id,
        arrivesAt: arrivalTime.arrives_at,
        isOwner: true,
        position: { x: position.x, y: position.y },
      };
    },
    [account],
  );

  useEffect(() => {
    const arrivals = getArrivalsWithResourceOnPosition(playerStructurePositions)
      .map(createArrivalInfo)
      .filter((arrival: any): arrival is ArrivalInfo => arrival !== undefined);

    setEntitiesWithInventory(arrivals);
  }, [playerStructurePositions]);

  useEffect(() => {
    const query = defineQuery([Has(Position), ...fragments], { runOnInit: false });

    const sub = query.update$.subscribe((update) => {
      if (isComponentUpdate(update, Position)) {
        const newArrival = createArrivalInfo(update.entity);
        if (newArrival) {
          setEntitiesWithInventory((arrivals) => {
            const index = arrivals.findIndex((arrival) => arrival.entityId === newArrival.entityId);
            if (index !== -1) {
              return [...arrivals.slice(0, index), newArrival, ...arrivals.slice(index + 1)];
            } else {
              return [...arrivals, newArrival];
            }
          });
        }
      }
    });

    return () => sub.unsubscribe();
  }, [account]);

  const structurePositions = useMemo(
    () => new Set(playerStructurePositions.map((position) => `${position.x},${position.y}`)),
    [playerStructurePositions],
  );

  return useMemo(
    () =>
      entitiesWithInventory
        .sort((a, b) => Number(a.arrivesAt) - Number(b.arrivesAt))
        .filter((arrival) => structurePositions.has(`${arrival.position.x},${arrival.position.y}`)),
    [entitiesWithInventory, structurePositions],
  );
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
      ? getOwnedEntitiesOnPosition(ContractAddress(account.address), { x: Number(position.x), y: Number(position.y) })
      : [];
    return depositEntityIds[0];
  };

  return {
    getOwnedEntitiesOnPosition,
    getOwnedEntityOnPosition,
  };
}
