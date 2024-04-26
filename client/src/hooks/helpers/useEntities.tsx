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
      components: { Realm, Owner, BankAccounts, EntityName },
    },
  } = useDojo();

  const playerRealms = useEntityQuery([Has(Realm), HasValue(Owner, { address: BigInt(account.address) })]);

  const getEntityName = (entityId: bigint) => {
    const entityName = getComponentValue(EntityName, getEntityIdFromKeys([entityId]));
    return entityName ? hexToAscii(numberToHex(Number(entityName.name))) : undefined;
  };

  const playerAccounts = useEntityQuery([HasValue(BankAccounts, { owner: BigInt(account.address) })]);

  return {
    playerRealms: () => {
      return playerRealms.map((id) => {
        const realm = getComponentValue(Realm, id);
        return { ...realm, position: getPosition(realm!.realm_id), name: getRealmNameById(realm!.realm_id) };
      });
    },
    playerAccounts: () => {
      return playerAccounts.map((id) => {
        const account = getComponentValue(BankAccounts, id);
        return { entity_id: account?.entity_id, name: `Bank ${account?.bank_entity_id.toString()}` };
      });
    },
    getEntityName
  };
};
