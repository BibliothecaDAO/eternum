import {
  allRealmsQuery,
  readRealmInfos,
  readStructureRows,
  realmsByOwnerQuery,
  villagesByOwnerQuery,
} from "@bibliothecadao/eternum";
import { ContractAddress, RealmInfo } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { useMemo } from "react";
import { useDojo } from "../context";

export function usePlayerOwnedRealmsInfo(): RealmInfo[] {
  const {
    setup: { components },
  } = useDojo();

  const realmEntities = usePlayerOwnedRealmEntities();

  return useMemo(() => readRealmInfos(components, realmEntities), [realmEntities]);
}

export function usePlayerOwnedVillagesInfo(): RealmInfo[] {
  const {
    setup: { components },
  } = useDojo();

  const villageEntities = usePlayerOwnedVillageEntities();

  return useMemo(() => readRealmInfos(components, villageEntities), [villageEntities]);
}

export const usePlayerOwnedVillageEntities = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  return useEntityQuery(villagesByOwnerQuery(components, ContractAddress(account.address)));
};

export const usePlayerOwnedRealmEntities = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  return useEntityQuery(realmsByOwnerQuery(components, ContractAddress(account.address)));
};

export const useAllRealms = () => {
  const {
    setup: { components },
  } = useDojo();

  const realmEntities = useEntityQuery(allRealmsQuery(components));

  return useMemo(() => readStructureRows(components, realmEntities), [realmEntities]);
};
