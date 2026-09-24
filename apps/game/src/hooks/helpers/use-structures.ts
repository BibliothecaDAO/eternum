import { readStructures } from "@bibliothecadao/eternum";
import type { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";
import { getPlayerName } from "@/services/identity/player-profiles";
import { usePlayerNamesRevision } from "@/hooks/use-player-profile";

export const usePlayerStructures = (owner?: ContractAddress) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["Structure"]);
  const names = usePlayerNamesRevision();
  const address = owner ?? BigInt(account.address);
  return useMemo(
    () => readStructures(store, address, BigInt(account.address), getPlayerName),
    [store, address, account.address, revision, ...names],
  );
};
