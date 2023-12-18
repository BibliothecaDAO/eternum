import { useMemo, useState } from "react";
import { Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import realmsCoordsJson from "../../geodata/coords.json";
import { useDojo } from "../../DojoContext";
import { getContractPositionFromRealPosition, getEntityIdFromKeys, hexToAscii, numberToHex } from "../../utils/utils";
import { getOrderName } from "@bibliothecadao/eternum";
import realmIdsByOrder from "../../data/realmids_by_order.json";
import realmsData from "../../geodata/realms.json";
import { unpackResources } from "../../utils/packedData";
import { useEntityQuery } from "@dojoengine/react";
import { RealmInterface } from "@bibliothecadao/eternum";
import { getRealmNameById } from "../../utils/realms";

export type RealmExtended = RealmInterface & {
  entity_id: Entity;
  resources: number[];
};

export function useRealm() {
  const {
    setup: {
      components: { Realm, AddressName, Owner },
    },
  } = useDojo();

  const getNextRealmIdForOrder = (order: number) => {
    const orderName = getOrderName(order);

    const entityIds = runQuery([HasValue(Realm, { order })]);

    let latestRealmIdFromOrder = 0n;

    // sort from biggest to lowest
    if (entityIds.size > 0) {
      const realmEntityId = Array.from(entityIds).sort((a: any, b: any) => b - a)[0];
      const latestRealmFromOrder = getComponentValue(Realm, realmEntityId);
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

  return {
    getNextRealmIdForOrder,
    getAddressName,
    getRealmAddressName,
    getRealmIdForOrderAfter,
  };
}

export function useGetRealm(realmEntityId: bigint | undefined) {
  const {
    setup: {
      components: { Realm, Position, Owner },
    },
  } = useDojo();

  const [realm, setRealm] = useState<RealmInterface | undefined>(undefined);

  useMemo((): any => {
    if (realmEntityId) {
      let entityId = getEntityIdFromKeys([BigInt(realmEntityId)]);
      const realm = getComponentValue(Realm, entityId);
      const owner = getComponentValue(Owner, entityId);
      const position = getComponentValue(Position, entityId);

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
        setRealm({
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
          owner: address,
        });
      }
    }
  }, [realmEntityId]);

  return {
    realm,
  };
}

export function useGetRealms(): { realms: RealmExtended[] } {
  const {
    setup: {
      components: { Realm, Owner },
    },
  } = useDojo();

  const realmEntityIds = useEntityQuery([Has(Realm)]);

  const realms: RealmExtended[] = useMemo(
    () =>
      Array.from(realmEntityIds)
        .map((entityId) => {
          const realm = getComponentValue(Realm, entityId);
          if (realm) {
            let name = realmsData["features"][Number(realm.realm_id) - 1].name;
            let owner = getComponentValue(Owner, entityId);
            let resources = unpackResources(BigInt(realm.resource_types_packed), realm.resource_types_count);
            let coords = realmsCoordsJson["features"][Number(realm.realm_id)]["geometry"]["coordinates"];
            let position = getContractPositionFromRealPosition({ x: parseInt(coords[0]), y: parseInt(coords[1]) });

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
              position: position,
              owner: owner?.address,
              entity_id: entityId,
              resources,
            };
          }
        })
        .filter(Boolean) as RealmExtended[],
    [realmEntityIds],
  );

  return {
    realms,
  };
}
