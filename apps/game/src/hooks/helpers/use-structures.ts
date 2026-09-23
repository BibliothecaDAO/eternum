import { readStructures } from "@bibliothecadao/eternum";
import type { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";

export const usePlayerStructures = (owner?: ContractAddress) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["Structure", "AddressName"]);
  const address = owner ?? BigInt(account.address);
  return useMemo(
    () => readStructures(store, address, BigInt(account.address)),
    [store, address, account.address, revision],
  );
};
