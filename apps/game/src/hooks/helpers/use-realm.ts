import { readStructureIds } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";

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
