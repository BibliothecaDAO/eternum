import { readStructures } from "@bibliothecadao/eternum";
import type { ContractAddress } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "./use-native-facts";
import { usePlayerNames } from "@/hooks/use-player-profile";

export const usePlayerStructures = (owner?: ContractAddress) => {
  const {
    account: { account },
  } = useGame();
  const facts = useNativeFacts(["Structure", "TileOccupancy"]);
  const names = usePlayerNames();
  const address = owner ?? BigInt(account.address);
  return useMemo(
    () => readStructures(facts.store, address, BigInt(account.address), names.text),
    [facts, address, account.address, names],
  );
};
