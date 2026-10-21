import { readMarket, readOpenTrades } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { usePlayerOwnedRealmEntities, usePlayerOwnedVillageEntities } from "./use-realm";
import { useNativeFacts } from "./use-native-facts";
import { usePlayerNames } from "@/hooks/use-player-profile";

export function useMarket(currentBlockTimestamp: number) {
  const realms = usePlayerOwnedRealmEntities();
  const villages = usePlayerOwnedVillageEntities();
  const facts = useNativeFacts(["TradeOrder", "Structure"]);
  const names = usePlayerNames();
  return useMemo(
    () => readMarket(readOpenTrades(facts.store, currentBlockTimestamp, names.text), [...realms, ...villages]),
    [facts, currentBlockTimestamp, realms, villages, names],
  );
}
