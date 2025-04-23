import { getRealmInfo, } from "@bibliothecadao/eternum";
import { ClientComponents, ContractAddress, RealmInfo, StructureType } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { ComponentValue, getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../context";

export function usePlayerOwnedRealmsInfo(): RealmInfo[] {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { Structure } = components;

  const realmEntities = useEntityQuery([
    Has(Structure),
    HasValue(Structure, { owner: ContractAddress(account.address), category: StructureType.Realm }),
  ]);

  const realms = useMemo(() => {
    return realmEntities
      .map((entity) => {
        return getRealmInfo(entity, components);
      })
      .filter(Boolean) as RealmInfo[];
  }, [realmEntities]);

  return realms;
}

export function usePlayerOwnedVillagesInfo(): RealmInfo[] {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { Structure } = components;

  const villageEntities = useEntityQuery([
    Has(Structure),
    HasValue(Structure, { owner: ContractAddress(account.address), category: StructureType.Village }),
  ]);

  const villages = useMemo(() => {
    return villageEntities
      .map((entity) => {
        return getRealmInfo(entity, components);
      })
      .filter(Boolean) as RealmInfo[];
  }, [villageEntities]);

  return villages;
}

export const usePlayerOwnedVillageEntities = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { Structure } = components;

  const villageEntities = useEntityQuery([
    Has(Structure),
    HasValue(Structure, { owner: ContractAddress(account.address), category: StructureType.Village }),
  ]);

  return villageEntities;
};

export const usePlayerOwnedRealmEntities = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { Structure } = components;

  const realmEntities = useEntityQuery([
    Has(Structure),
    HasValue(Structure, { owner: ContractAddress(account.address), category: StructureType.Realm }),
  ]);

  return realmEntities;
};

export const useAllRealms = () => {
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
