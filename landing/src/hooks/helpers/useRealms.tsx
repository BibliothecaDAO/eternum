import { type ID } from "@bibliothecadao/eternum";
import { type Entity, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";

// interface RealmInfo {
//   realmId: ID;
//   entityId: ID;
//   name: string;
//   resourceTypesPacked: bigint;
//   order: number;
//   position: ComponentValue<ClientComponents["Position"]["schema"]>;
//   population?: number | undefined;
//   capacity?: number;
//   hasCapacity: boolean;
//   owner: ContractAddress;
//   ownerName: string;
// }

export function useRealm() {
  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  const getRealmEntityIdFromRealmId = (realmId: ID): ID | undefined => {
    const realmEntityIds = runQuery([HasValue(Realm, { realm_id: realmId })]);
    if (realmEntityIds.size > 0) {
      const realm = getComponentValue(Realm, realmEntityIds.values().next().value || ("" as Entity));
      return realm!.entity_id;
    }
  };
  return {
    getRealmEntityIdFromRealmId,
  };
}
