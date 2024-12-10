import { configManager } from "@/dojo/setup";
import {
  CapacityConfigCategory,
  ContractAddress,
  ID,
  Position,
  ResourcesIds,
  resources,
  type Resource,
} from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { Has, HasValue, Not, getComponentValue, runQuery, type Entity } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";
import { ResourceManager } from "../../dojo/modelManager/ResourceManager";
import { getEntityIdFromKeys } from "../../ui/utils/utils";
import { useDojo } from "../context/DojoContext";
import useUIStore from "../store/useUIStore";

export function useResourcesUtils() {
  const { setup } = useDojo();
  const {
    components: { Weight, Resource, ResourceCost, Realm, CapacityCategory },
  } = setup;

  const weightLessResources = useMemo(() => {
    return configManager.getWeightLessResources();
  }, []);

  const useResourcesFromBalance = (entityId: ID) => {
    const currentDefaultTick = useUIStore((state) => state.currentDefaultTick);
    const weight = useComponentValue(Weight, getEntityIdFromKeys([BigInt(entityId)]));
    const capacityCategory = useComponentValue(CapacityCategory, getEntityIdFromKeys([BigInt(entityId)]));

    return useMemo(() => {
      if (!weight?.value && capacityCategory?.category !== CapacityConfigCategory[CapacityConfigCategory.Structure])
        return [];

      return resources
        .map(({ id }) => {
          const resourceManager = new ResourceManager(setup, entityId, id);
          const balance = resourceManager.balance(currentDefaultTick);
          return { resourceId: id, amount: balance };
        })
        .filter(({ amount }) => amount > 0);
    }, [weight, entityId, currentDefaultTick]);
  };

  const getResourcesFromBalance = (entityId: ID): Resource[] => {
    const currentDefaultTick = useUIStore.getState().currentDefaultTick;

    const weight = getComponentValue(Weight, getEntityIdFromKeys([BigInt(entityId)]));
    const hasWeightlessResources = weightLessResources.some(
      (resourceId) =>
        (getComponentValue(Resource, getEntityIdFromKeys([BigInt(entityId), BigInt(resourceId)]))?.balance ?? 0n) > 0n,
    );
    if (!weight?.value && !hasWeightlessResources) return [];
    const resourceIds = resources.map((r) => r.id);
    return resourceIds
      .map((id) => {
        const resourceManager = new ResourceManager(setup, entityId, id);
        const balance = resourceManager.balance(currentDefaultTick);
        return { resourceId: id, amount: balance };
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
    const currentDefaultTick = useUIStore.getState().currentDefaultTick;
    const realmsWithResource = allRealms
      .map((id: Entity) => {
        const realm = getComponentValue(Realm, id);
        const resourceManager = realm ? new ResourceManager(setup, realm.entity_id, resourceId) : undefined;
        const resource = resourceManager
          ? {
              balance: resourceManager.balance(currentDefaultTick),
            }
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
    useResourcesFromBalance,
  };
}

export function useResourceBalance() {
  const dojo = useDojo();

  const getFoodResources = (entityId: ID): Resource[] => {
    const currentDefaultTick = useUIStore.getState().currentDefaultTick;
    const wheatBalance = new ResourceManager(dojo.setup, entityId, ResourcesIds.Wheat).balance(currentDefaultTick);
    const fishBalance = new ResourceManager(dojo.setup, entityId, ResourcesIds.Fish).balance(currentDefaultTick);

    return [
      { resourceId: ResourcesIds.Wheat, amount: wheatBalance },
      { resourceId: ResourcesIds.Fish, amount: fishBalance },
    ];
  };

  const getResourceProductionInfo = (entityId: ID, resourceId: ResourcesIds) => {
    const resourceManager = new ResourceManager(dojo.setup, entityId, resourceId);
    return resourceManager.getProduction();
  };

  const getBalance = (entityId: ID, resourceId: ResourcesIds) => {
    const currentDefaultTick = useUIStore.getState().currentDefaultTick;
    const resourceManager = new ResourceManager(dojo.setup, entityId, resourceId);
    return { balance: resourceManager.balance(currentDefaultTick), resourceId };
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
      const resourceManager = new ResourceManager(dojo.setup, entityId, resourceId);
      setResourceBalance({ amount: resourceManager.balance(currentDefaultTick), resourceId });
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

export const useResourceManager = (entityId: ID, resourceId: ResourcesIds) => {
  const dojo = useDojo();
  const production = useComponentValue(
    dojo.setup.components.Production,
    getEntityIdFromKeys([BigInt(entityId), BigInt(resourceId)]),
  );

  const resourceManager = useMemo(() => {
    return new ResourceManager(dojo.setup, entityId, resourceId);
  }, [dojo.setup, entityId, resourceId, production]);

  return resourceManager;
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
