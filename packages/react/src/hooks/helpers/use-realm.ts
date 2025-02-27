import { ClientComponents, ContractAddress, getRealmInfo, RealmInfo, StructureType } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { ComponentValue, getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../context";

export function usePlayerOwnedRealms(): RealmInfo[] {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { Structure } = components;

  const realmEntities = useEntityQuery([Has(Structure), HasValue(Structure, { owner: ContractAddress(account.address), category: StructureType.Realm })]);

  const realms = useMemo(() => {
    return realmEntities
      .map((entity) => {
        return getRealmInfo(entity, components);
      })
      .filter(Boolean) as RealmInfo[];
  }, [realmEntities]);

  return realms;
}

export const useRealms = () => {
  const {
    setup: {
      components: { Structure },
    },
  } = useDojo();

  const realmEntities = useEntityQuery([Has(Structure), HasValue(Structure, { category: StructureType.Realm })]);

  const realms = useMemo(() => {
    return realmEntities
      .map((entity) => {
        return getComponentValue(Structure, entity);
      })
      .filter(Boolean) as ComponentValue<ClientComponents["Structure"]["schema"]>[];
  }, [realmEntities]);

  return realms;
};
