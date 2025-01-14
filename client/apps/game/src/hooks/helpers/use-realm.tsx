import { useDojo } from "@/hooks/context/dojo-context";
import { getRealmInfo } from "@/utils/realm";
import { ContractAddress, RealmInfo } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue } from "@dojoengine/recs";
import { useMemo } from "react";

export function usePlayerRealms(): RealmInfo[] {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { Realm, Owner } = components;

  const realmEntities = useEntityQuery([Has(Realm), HasValue(Owner, { address: ContractAddress(account.address) })]);

  const realms = useMemo(() => {
    return realmEntities
      .map((entity) => {
        return getRealmInfo(entity, components);
      })
      .filter(Boolean) as RealmInfo[];
  }, [realmEntities]);

  return realms;
}
