import { readMarket, readOpenTrades } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { usePlayerOwnedRealmEntities, usePlayerOwnedVillageEntities } from "./use-realm";
import { useNativeRevision } from "./use-native-facts";

export function useMarket(currentBlockTimestamp: number) {
  const {
    setup: { store },
  } = useGame();
  const realms = usePlayerOwnedRealmEntities();
  const villages = usePlayerOwnedVillageEntities();
  const revision = useNativeRevision(["TradeOrder", "Structure", "AddressName"]);
  return useMemo(
    () => readMarket(readOpenTrades(store, currentBlockTimestamp), [...realms, ...villages]),
    [store, currentBlockTimestamp, realms, villages, revision],
  );
}
