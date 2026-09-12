import { openTradesQuery, readMarket, readOpenTrades } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { useMemo } from "react";
import { useDojo, usePlayerOwnedRealmEntities, usePlayerOwnedVillageEntities } from "../";

export function useMarket(currentBlockTimestamp: number) {
  const {
    setup: { components },
  } = useDojo();

  const playerRealmEntities = usePlayerOwnedRealmEntities();
  const playerVillageEntities = usePlayerOwnedVillageEntities();

  const tradeEntities = useEntityQuery(openTradesQuery(components));
  const openTrades = useMemo(() => readOpenTrades(components, tradeEntities, currentBlockTimestamp), [tradeEntities]);

  return useMemo(
    () => readMarket(openTrades, [...playerRealmEntities, ...playerVillageEntities]),
    [openTrades, playerRealmEntities, playerVillageEntities],
  );
}
