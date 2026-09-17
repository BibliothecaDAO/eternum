import { readRealmInfos, readStructureIds, readStructureRows } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "../context";
import { useNativeRevision } from "./use-native-facts";

const useOwnedRealmInfo = (category: StructureType) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["Structure", "StructureBuildings", "ResourceWeight", "AddressName"]);
  return useMemo(
    () => readRealmInfos(store, BigInt(account.address), category),
    [store, account.address, category, revision],
  );
};
export const usePlayerOwnedRealmsInfo = () => useOwnedRealmInfo(StructureType.Realm);
export const usePlayerOwnedVillagesInfo = () => useOwnedRealmInfo(StructureType.Village);

const useOwnedStructureIds = (category: StructureType) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["Structure"]);
  return useMemo(
    () => readStructureIds(store, BigInt(account.address), category),
    [store, account.address, category, revision],
  );
};
export const usePlayerOwnedVillageEntities = () => useOwnedStructureIds(StructureType.Village);
export const usePlayerOwnedRealmEntities = () => useOwnedStructureIds(StructureType.Realm);

export const useAllRealms = () => {
  const {
    setup: { store },
  } = useGame();
  const revision = useNativeRevision(["Structure"]);
  return useMemo(() => readStructureRows(store, StructureType.Realm), [store, revision]);
};
