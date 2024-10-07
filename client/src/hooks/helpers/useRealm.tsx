import { ClientComponents } from "@/dojo/createClientComponents";
import {
  BASE_POPULATION_CAPACITY,
  ContractAddress,
  ID,
  getOrderName,
  getQuestResources as getStartingResources,
} from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { ComponentValue, Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useMemo } from "react";
import { shortString } from "starknet";
import realmIdsByOrder from "../../data/realmids_by_order.json";
import { unpackResources } from "../../ui/utils/packedData";
import { getRealmNameById } from "../../ui/utils/realms";
import { getEntityIdFromKeys, getPosition } from "../../ui/utils/utils";
import { useDojo } from "../context/DojoContext";
import useUIStore from "../store/useUIStore";

type RealmInfo = {
  realmId: ID;
  entityId: ID;
  name: string;
  cities: number;
  rivers: number;
  wonder: number;
  harbors: number;
  regions: number;
  resourceTypesCount: number;
  resourceTypesPacked: bigint;
  order: number;
  position: ComponentValue<ClientComponents["Position"]["schema"]>;
  population?: number | undefined;
  capacity?: number;
  hasCapacity: boolean;
  owner: ContractAddress;
  ownerName: string;
};

export function useRealm() {
  const {
    setup: {
      components: { Realm, AddressName, Owner, EntityOwner, Position, Structure },
    },
  } = useDojo();
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const getQuestResources = () => {
    const realm = getComponentValue(Realm, getEntityIdFromKeys([BigInt(structureEntityId)]));
    const resourcesProduced = realm ? unpackResources(realm.resource_types_packed, realm.resource_types_count) : [];
    return getStartingResources(resourcesProduced);
  };

  const getEntityOwner = (entityId: ID) => {
    const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([BigInt(entityId)]));
    return entityOwner?.entity_owner_id;
  };

  const isRealmIdSettled = (realmId: ID) => {
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
      const latestRealmFromOrder = getComponentValue(Realm, getEntityIdFromKeys([BigInt(realmEntityId)]));
      if (latestRealmFromOrder) {
        latestRealmIdFromOrder = Number(latestRealmFromOrder.realm_id);
      }
    }

    const orderRealmIds = (realmIdsByOrder as { [key: string]: ID[] })[orderName];
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

      const position = getPosition(nextRealmIdFromOrder);

      // check if there is a structure on position, if no structure we can keep this realm Id
      if (Array.from(runQuery([HasValue(Position, { x: position.x, y: position.y }), Has(Structure)])).length === 0) {
        return nextRealmIdFromOrder;
      } else {
        latestRealmIdFromOrder = nextRealmIdFromOrder;
      }
    }

    throw new Error(`Could not find an unoccupied realm ID for order ${orderName} after ${maxIterations} attempts`);
  };

  const getRealmEntityIdFromRealmId = (realmId: ID): ID | undefined => {
    const realmEntityIds = runQuery([HasValue(Realm, { realm_id: realmId })]);
    if (realmEntityIds.size > 0) {
      const realm = getComponentValue(Realm, realmEntityIds.values().next().value || ("" as Entity));
      return realm!.entity_id;
    }
  };

  const getRealmIdFromRealmEntityId = (realmEntityId: ID) => {
    const realm = getComponentValue(Realm, getEntityIdFromKeys([BigInt(realmEntityId)]));
    return realm?.realm_id;
  };

  const getRealmIdForOrderAfter = (order: number, realmId: ID): ID => {
    const orderName = getOrderName(order);

    const orderRealmIds = (realmIdsByOrder as { [key: string]: ID[] })[orderName];
    const latestIndex = orderRealmIds.indexOf(realmId);

    if (latestIndex === -1 || latestIndex === orderRealmIds.length - 1) {
      return orderRealmIds[0];
    } else {
      return orderRealmIds[latestIndex + 1];
    }
  };

  const getAddressName = (address: ContractAddress): string | undefined => {
    const addressName = getComponentValue(AddressName, getEntityIdFromKeys([address]));

    return addressName ? shortString.decodeShortString(addressName.name.toString()) : undefined;
  };

  const getAddressOrder = (address: ContractAddress) => {
    const ownedRealms = runQuery([Has(Realm), HasValue(Owner, { address })]);
    if (ownedRealms.size > 0) {
      const realm = getComponentValue(Realm, ownedRealms.values().next().value || ("" as Entity));
      return realm?.order;
    }
  };

  const getRealmAddressName = (realmEntityId: ID) => {
    const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(realmEntityId)]));
    const addressName = owner ? getComponentValue(AddressName, getEntityIdFromKeys([owner.address])) : undefined;

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

  const isEntityIdRealm = (entityId: ID) => {
    const realm = getComponentValue(Realm, getEntityIdFromKeys([BigInt(entityId)]));
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

export function useGetRealm(realmEntityId: ID | undefined) {
  const {
    setup: {
      components: { Realm, Position, Owner, Population },
    },
  } = useDojo();

  const query = useEntityQuery([HasValue(Realm, { entity_id: realmEntityId })]);

  const realm = useMemo((): any => {
    if (realmEntityId !== undefined) {
      let entityId = getEntityIdFromKeys([BigInt(realmEntityId)]);
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

export function getRealms(): RealmInfo[] {
  const {
    setup: {
      components: { Realm, Position, Owner, Population, AddressName, Structure },
    },
  } = useDojo();

  const realmEntities = runQuery([Has(Realm)]);

  return Array.from(realmEntities)
    .map((entity) => {
      const realm = getComponentValue(Realm, entity);
      const owner = getComponentValue(Owner, entity);
      const position = getComponentValue(Position, entity);
      const population = getComponentValue(Population, entity);

      if (!realm || !owner || !position) return;

      const {
        realm_id,
        entity_id,
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

      const addressName = getComponentValue(AddressName, getEntityIdFromKeys([address]));
      const ownerName = shortString.decodeShortString(addressName?.name.toString() ?? "0x0");

      return {
        realmId: realm_id,
        entityId: entity_id,
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
        ownerName,
      };
    })
    .filter((realm) => realm !== undefined);
}
