import { readStructureIds } from "@bibliothecadao/eternum";
import { StructureType, type ID } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "../context";
import { useNativeRevision } from "./use-native-facts";

export const useOwnedHyperstructuresEntityIds = (): ID[] => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["Structure"]);
  return useMemo(
    () => readStructureIds(store, BigInt(account.address), StructureType.Hyperstructure),
    [store, account.address, revision],
  );
};
