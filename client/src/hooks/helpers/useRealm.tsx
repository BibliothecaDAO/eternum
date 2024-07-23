import { BASE_POPULATION_CAPACITY, RealmInterface, getOrderName } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useMemo } from "react";
import { shortString } from "starknet";
import realmIdsByOrder from "../../data/realmids_by_order.json";
import { unpackResources } from "../../ui/utils/packedData";
import { getRealm, getRealmNameById } from "../../ui/utils/realms";
import { getEntityIdFromKeys, getPosition } from "../../ui/utils/utils";
import { useDojo } from "../context/DojoContext";
import { getQuestResources as getStartingResources } from "@bibliothecadao/eternum";
import useRealmStore from "../store/useRealmStore";

export type RealmExtended = RealmInterface & {
  entity_id: bigint;
  resources: number[];
};

export function useRealm() {
  const {
    setup: {
      components: { Realm, AddressName, Owner, EntityOwner, Position, Structure },
    },
  } = useDojo();

  const getQuestResources = () => {
    const realmEntityId = useRealmStore.getState().realmEntityId;
    const realm = getComponentValue(Realm, getEntityIdFromKeys([BigInt(realmEntityId)]));
    const resourcesProduced = realm ? unpackResources(realm.resource_types_packed, realm.resource_types_count) : [];
    return getStartingResources(resourcesProduced);
  };

  const getEntityOwner = (entityId: bigint) => {
    const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([entityId]));
    return entityOwner?.entity_owner_id;
  };

  const isRealmIdSettled = (realmId: bigint) => {
    const entityIds = runQuery([HasValue(Realm, { realm_id: realmId })]);
    return entityIds.size > 0;
  };

  const getNextRealmIdForOrder = (order: number) => {
    const orderName = getOrderName(order);

    const entityIds = Array.from(runQuery([HasValue(Realm, { order })]));
    const realmEntityIds = entityIds.map((id) => {
      return getComponentValue(Realm, id)!.entity_id;
    });

    let latestRealmIdFromOrder = 0;
    if (realmEntityIds.length > 0) {
      const realmEntityId = realmEntityIds.sort((a, b) => Number(b) - Number(a))[0];
      const latestRealmFromOrder = getComponentValue(Realm, getEntityIdFromKeys([realmEntityId]));
      if (latestRealmFromOrder) {
        latestRealmIdFromOrder = Number(latestRealmFromOrder.realm_id);
      }
    }

    const orderRealmIds = (realmIdsByOrder as { [key: string]: number[] })[orderName];
    let nextRealmIdFromOrder = 0;

    const maxIterations = orderRealmIds.length;
    for (let i = 0; i < maxIterations; i++) {
      // sort from biggest to lowest
      const latestIndex = orderRealmIds.indexOf(latestRealmIdFromOrder);

      if (latestIndex === -1 || latestIndex === orderRealmIds.length - 1) {
        nextRealmIdFromOrder = orderRealmIds[0];
      } else {
        nextRealmIdFromOrder = orderRealmIds[latestIndex + 1];
      }

      const position = getPosition(BigInt(nextRealmIdFromOrder));

      // check if there is a structure on position, if no structure we can keep this realm Id
      if (Array.from(runQuery([HasValue(Position, { x: position.x, y: position.y }), Has(Structure)])).length === 0) {
        return BigInt(nextRealmIdFromOrder);
      } else {
        latestRealmIdFromOrder = nextRealmIdFromOrder;
      }
    }

    throw new Error(`Could not find an unoccupied realm ID for order ${orderName} after ${maxIterations} attempts`);
  };

  const getRealmEntityIdFromRealmId = (realmId: bigint): bigint | undefined => {
    const realmEntityIds = runQuery([HasValue(Realm, { realm_id: realmId })]);
    if (realmEntityIds.size > 0) {
      const realm = getComponentValue(Realm, realmEntityIds.values().next().value);
      return realm!.entity_id;
    }
  };

  const getRealmIdFromRealmEntityId = (realmEntityId: bigint) => {
    const realm = getComponentValue(Realm, getEntityIdFromKeys([realmEntityId]));
    return realm?.realm_id;
  };

  const getRealmIdForOrderAfter = (order: number, realmId: bigint) => {
    const orderName = getOrderName(order);

    const orderRealmIds = (realmIdsByOrder as { [key: string]: number[] })[orderName];
    const latestIndex = orderRealmIds.indexOf(Number(realmId));

    if (latestIndex === -1 || latestIndex === orderRealmIds.length - 1) {
      return BigInt(orderRealmIds[0]);
    } else {
      return BigInt(orderRealmIds[latestIndex + 1]);
    }
  };

  const getAddressName = (address: string) => {
    const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]));

    return addressName ? shortString.decodeShortString(addressName.name.toString()) : undefined;
  };

  const getAddressOrder = (address: string) => {
    const ownedRealms = runQuery([Has(Realm), HasValue(Owner, { address: BigInt(address) })]);
    if (ownedRealms.size > 0) {
      const realm = getComponentValue(Realm, ownedRealms.values().next().value);
      return realm?.order;
    }
  };

  const getRealmAddressName = (realmEntityId: bigint) => {
    const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(realmEntityId)]));
    const addressName = owner
      ? getComponentValue(AddressName, getEntityIdFromKeys([BigInt(owner.address)]))
      : undefined;

    if (addressName) {
      return shortString.decodeShortString(String(addressName.name));
    } else {
      return "";
    }
  };

  const getRealmEntityIdsOnPosition = (x: number, y: number) => {
    const entityIds = runQuery([Has(Realm), HasValue(Position, { x, y })]);
    const realmEntityIds = Array.from(entityIds).map((entityId) => {
      return getComponentValue(Realm, entityId)!.entity_id;
    });
    return realmEntityIds.length === 1 ? realmEntityIds[0] : undefined;
  };

  const isEntityIdRealm = (entityId: bigint) => {
    const realm = getComponentValue(Realm, getEntityIdFromKeys([entityId]));
    return realm ? true : false;
  };

  return {
    getQuestResources,
    getEntityOwner,
    isRealmIdSettled,
    getNextRealmIdForOrder,
    getAddressName,
    getAddressOrder,
    getRealmAddressName,
    getRealmIdForOrderAfter,
    getRealmIdFromRealmEntityId,
    getRealmEntityIdFromRealmId,
    isEntityIdRealm,
    getRealmEntityIdsOnPosition,
  };
}

export function useGetRealm(realmEntityId: bigint | undefined) {
  const {
    setup: {
      components: { Realm, Position, Owner, Population },
    },
  } = useDojo();

  const query = useEntityQuery([HasValue(Realm, { entity_id: realmEntityId })]);

  const realm = useMemo((): any => {
    if (realmEntityId !== undefined) {
      let entityId = getEntityIdFromKeys([realmEntityId]);
      const realm = getComponentValue(Realm, entityId);
      const owner = getComponentValue(Owner, entityId);
      const position = getComponentValue(Position, entityId);
      const population = getComponentValue(Population, entityId);

      if (realm && owner && position) {
        const {
          realm_id,
          cities,
          rivers,
          wonder,
          harbors,
          regions,
          resource_types_count,
          resource_types_packed,
          order,
        } = realm;

        const name = getRealmNameById(realm_id);

        const { address } = owner;

        return {
          realmId: realm_id,
          name,
          cities,
          rivers,
          wonder,
          harbors,
          regions,
          resourceTypesCount: resource_types_count,
          resourceTypesPacked: resource_types_packed,
          order,
          position,
          ...population,
          hasCapacity: !population || population.capacity + BASE_POPULATION_CAPACITY > population.population,
          owner: address,
        };
      }
    }
  }, [realmEntityId, query]);

  return {
    realm,
  };
}

export function useGetRealms(): RealmExtended[] {
  const {
    setup: {
      components: { Realm, Owner },
    },
  } = useDojo();

  const { getRealmAddressName } = useRealm();

  // will force update the values when they change in the contract
  const realmEntityIds = useEntityQuery([Has(Realm)]);

  const realms: RealmExtended[] = useMemo(
    () =>
      realmEntityIds
        .map((entityId) => {
          const realm = getComponentValue(Realm, entityId);
          if (realm) {
            const realmData = getRealm(realm.realm_id);
            if (!realmData) return undefined;
            let name = realmData.name;
            let owner = getComponentValue(Owner, entityId);
            let resources = unpackResources(BigInt(realm.resource_types_packed), realm.resource_types_count);

            if (name) {
              return {
                realmId: realm.realm_id,
                name,
                cities: realm.cities,
                rivers: realm.rivers,
                wonder: realm.wonder,
                harbors: realm.harbors,
                regions: realm.regions,
                resourceTypesCount: realm.resource_types_count,
                resourceTypesPacked: realm.resource_types_packed,
                order: realm.order,
                position: realmData.position,
                owner: owner?.address,
                ownerName: getRealmAddressName(realm.entity_id),
                entity_id: realm.entity_id,
                resources,
              };
            }
          }
        })
        .filter(Boolean) as RealmExtended[],
    [realmEntityIds.length], // Only recompute if the size of realmEntityIds has changed
  );

  return realms;
}
