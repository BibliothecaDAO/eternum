import { ClientComponents, ContractAddress, getRealmInfo, RealmInfo } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { ComponentValue, getComponentValue, Has } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../context";

export function usePlayerOwnedRealms(): RealmInfo[] {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { Realm, Structure } = components;

  // todo: fix filtering
  const realmEntities = useEntityQuery([Has(Realm)]);

  const realms = useMemo(() => {
    return realmEntities
      .map((entity) => {
        const structure = getComponentValue(Structure, entity);
        if (structure?.base.owner !== ContractAddress(account.address)) return;
        return getRealmInfo(entity, components);
      })
      .filter(Boolean) as RealmInfo[];
  }, [realmEntities]);

  return realms;
}

export const useRealms = () => {
  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  const realmEntities = useEntityQuery([Has(Realm)]);

  const realms = useMemo(() => {
    return realmEntities
      .map((entity) => {
        return getComponentValue(Realm, entity);
      })
      .filter(Boolean) as ComponentValue<ClientComponents["Realm"]["schema"]>[];
  }, [realmEntities]);

  return realms;
};
