import { useMemo } from "react";
import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { getEntityIdFromKeys, hexToAscii, numberToHex } from "../../ui/utils/utils";
import { BASE_POPULATION_CAPACITY, getOrderName } from "@bibliothecadao/eternum";
import realmIdsByOrder from "../../data/realmids_by_order.json";
import { unpackResources } from "../../ui/utils/packedData";
import { useEntityQuery } from "@dojoengine/react";
import { RealmInterface } from "@bibliothecadao/eternum";
import { getRealm, getRealmNameById } from "../../ui/utils/realms";

export type RealmExtended = RealmInterface & {
  entity_id: bigint;
  resources: number[];
};

export function useRealm() {
  const {
    setup: {
      components: { Realm, AddressName, Owner, Position },
    },
  } = useDojo();

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

    let latestRealmIdFromOrder = 0n;

    // sort from biggest to lowest
    if (realmEntityIds.length > 0) {
      const realmEntityId = realmEntityIds.sort((a, b) => Number(b) - Number(a))[0];
      const latestRealmFromOrder = getComponentValue(Realm, getEntityIdFromKeys([realmEntityId]));
      if (latestRealmFromOrder) {
        latestRealmIdFromOrder = latestRealmFromOrder.realm_id;
      }
    }
    const orderRealmIds = (realmIdsByOrder as { [key: string]: number[] })[orderName];
    const latestIndex = orderRealmIds.indexOf(Number(latestRealmIdFromOrder));

    if (latestIndex === -1 || latestIndex === orderRealmIds.length - 1) {
      return orderRealmIds[0];
    } else {
      return orderRealmIds[latestIndex + 1];
    }
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
      return orderRealmIds[0];
    } else {
      return orderRealmIds[latestIndex + 1];
    }
  };

  const getAddressName = (address: string) => {
    const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]));
    return addressName ? hexToAscii(numberToHex(Number(addressName.name))) : undefined;
  };

  const getRealmAddressName = (realmEntityId: bigint) => {
    const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(realmEntityId)]));
    const addressName = owner
      ? getComponentValue(AddressName, getEntityIdFromKeys([BigInt(owner.address)]))
      : undefined;

    if (addressName) {
      return hexToAscii(numberToHex(Number(addressName.name)));
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
    isRealmIdSettled,
    getNextRealmIdForOrder,
    getAddressName,
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
  }, [realmEntityId]);

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
