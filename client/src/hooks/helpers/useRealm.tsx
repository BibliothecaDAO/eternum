import { useMemo, useState } from "react";
import { RealmInterface } from "../graphql/useGraphQLQueries";
import { Has, HasValue, getComponentValue, runQuery } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { getEntityIdFromKeys } from "../../utils/utils";
import { getOrderName } from "@bibliothecadao/eternum";
import realmIdsByOrder from "../../data/realmids_by_order.json";
import realmsData from "../../geodata/realms.json";
import { unpackResources } from "../../utils/packedData";
import { useEntityQuery } from "@dojoengine/react";

export function useRealm() {
  const {
    setup: {
      components: { Realm, Level },
    },
  } = useDojo();

  const getNextRealmIdForOrder = (order: number) => {
    const orderName = getOrderName(order);

    const entityIds = runQuery([HasValue(Realm, { order })]);

    let latestRealmIdFromOrder = 0;

    // sort from biggest to lowest
    if (entityIds.size > 0) {
      const realmEntityId = Array.from(entityIds).sort((a, b) => b - a)[0];
      const latestRealmFromOrder = getComponentValue(Realm, realmEntityId);
      if (latestRealmFromOrder) {
        latestRealmIdFromOrder = latestRealmFromOrder.realm_id;
      }
    }
    const orderRealmIds = (realmIdsByOrder as { [key: string]: number[] })[orderName];
    const latestIndex = orderRealmIds.indexOf(latestRealmIdFromOrder);

    if (latestIndex === -1 || latestIndex === orderRealmIds.length - 1) {
      return orderRealmIds[0];
    } else {
      return orderRealmIds[latestIndex + 1];
    }
  };

  const getRealmLevel = (
    realmEntityId: number,
  ): { level: number; validUntil: number; percentage: number } | undefined => {
    const level = getComponentValue(Level, getEntityIdFromKeys([BigInt(realmEntityId)]));
    let percentage = 100;
    if (level?.level === 1) {
      percentage = 125;
    } else if (level?.level === 2) {
      percentage = 150;
    } else if (level?.level === 3) {
      percentage = 200;
    }
    return { level: level?.level || 0, validUntil: level?.valid_until || 0, percentage };
  };

  return {
    getNextRealmIdForOrder,
    getRealmLevel,
  };
}

export function useGetRealm(realmEntityId: number | undefined) {
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
        const { address } = owner;
        setRealm({
          realmId: realm_id,
          cities,
          rivers,
          wonder,
          harbors,
          regions,
          resource_types_count,
          resource_types_packed,
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

export function useGetRealms() {
  const {
    setup: {
      components: { Realm, Owner },
    },
  } = useDojo();

  const realmEntityIds = useEntityQuery([Has(Realm)]);

  const realms: any[] = useMemo(
    () =>
      Array.from(realmEntityIds).map((entityId) => {
        const realm = getComponentValue(Realm, entityId) as any;
        realm.entity_id = entityId;
        realm.name = realmsData["features"][realm.realm_id - 1].name;
        realm.owner = getComponentValue(Owner, entityId);
        realm.resources = unpackResources(BigInt(realm.resource_types_packed), realm.resource_types_count);
        return realm;
      }),
    [realmEntityIds],
  );

  return {
    realms,
  };
}
