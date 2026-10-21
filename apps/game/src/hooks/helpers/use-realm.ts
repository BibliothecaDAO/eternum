import { readStructureIds } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "./use-native-facts";

const useOwnedStructureIds = (category: StructureType) => {
  const {
    account: { account },
  } = useGame();
  const facts = useNativeFacts(["Structure"]);
  return useMemo(
    () => readStructureIds(facts.store, BigInt(account.address), category),
    [facts, account.address, category],
  );
};
export const usePlayerOwnedVillageEntities = () => useOwnedStructureIds(StructureType.Village);
export const usePlayerOwnedRealmEntities = () => useOwnedStructureIds(StructureType.Realm);
