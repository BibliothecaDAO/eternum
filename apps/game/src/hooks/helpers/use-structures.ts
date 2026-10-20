import { readStructures } from "@bibliothecadao/eternum";
import type { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";
import { usePlayerNames } from "@/hooks/use-player-profile";

export const usePlayerStructures = (owner?: ContractAddress) => {
  const {
    setup: { store },
    account: { account },
  } = useGame();
  const revision = useNativeRevision(["Structure", "TileOccupancy"]);
  const names = usePlayerNames();
  const address = owner ?? BigInt(account.address);
  return useMemo(
    () => readStructures(store, address, BigInt(account.address), names.text),
    [store, address, account.address, revision, names],
  );
};
