import { readMarket, readOpenTrades } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { usePlayerOwnedRealmEntities, usePlayerOwnedVillageEntities } from "./use-realm";
import { useNativeRevision } from "./use-native-facts";
import { getPlayerDisplayName } from "@/services/identity/player-profiles";
import { usePlayerNamesRevision } from "@/hooks/use-player-profile";

export function useMarket(currentBlockTimestamp: number) {
  const {
    setup: { store },
  } = useGame();
  const realms = usePlayerOwnedRealmEntities();
  const villages = usePlayerOwnedVillageEntities();
  const revision = useNativeRevision(["TradeOrder", "Structure"]);
  const names = usePlayerNamesRevision();
  return useMemo(
    () => readMarket(readOpenTrades(store, currentBlockTimestamp, getPlayerDisplayName), [...realms, ...villages]),
    [store, currentBlockTimestamp, realms, villages, revision, ...names],
  );
}
