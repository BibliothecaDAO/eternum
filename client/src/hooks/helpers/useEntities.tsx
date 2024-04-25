import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys, getPosition, numberToHex } from "@/ui/utils/utils";
import { getRealmNameById } from "@/ui/utils/realms";
import { hexToAscii } from "@dojoengine/utils";

export const useEntities = () => {
  const {
    account: { account },
    setup: {
      components: { Realm, Owner, EntityName },
    },
  } = useDojo();

  const playerRealms = useEntityQuery([Has(Realm), HasValue(Owner, { address: BigInt(account.address) })]);

  const getEntityName = (entityId: bigint) => {
    const entityName = getComponentValue(EntityName, getEntityIdFromKeys([entityId]));
    return entityName ? hexToAscii(numberToHex(Number(entityName.name))) : undefined;
  };

  return {
    playerRealms: () => {
      return playerRealms.map((id) => {
        const realm = getComponentValue(Realm, id);
        return { ...realm, position: getPosition(realm!.realm_id), name: getRealmNameById(realm!.realm_id) };
      });
    },
    getEntityName
  };
};
