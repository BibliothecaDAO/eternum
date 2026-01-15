import { computeTrades, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo, usePlayerOwnedRealmEntities, usePlayerOwnedVillageEntities } from "../";

export function useMarket(currentBlockTimestamp: number) {
  const {
    setup: { components },
  } = useDojo();

  const playerRealmsEntities = usePlayerOwnedRealmEntities();
  const playerVillagesEntities = usePlayerOwnedVillageEntities();

  const allMarket = useEntityQuery([HasValue(components.Trade, { taker_id: 0 })]);
  const allTrades = useMemo(() => {
    return computeTrades(allMarket, currentBlockTimestamp, components, false);
  }, [allMarket]);

  const userTrades = useMemo(() => {
    return allTrades.filter((trade) =>
      [...playerRealmsEntities, ...playerVillagesEntities].includes(getEntityIdFromKeys([BigInt(trade.makerId)])),
    );
  }, [allTrades, playerRealmsEntities, playerVillagesEntities]);

  const bidOffers = useMemo(() => {
    if (!allTrades) return [];
    return [...allTrades].filter(
      (offer) => offer.takerGets.length === 1 && offer.takerGets[0]?.resourceId === ResourcesIds.Lords,
    );
  }, [allTrades]);

  const askOffers = useMemo(() => {
    if (!allTrades) return [];
    return [...allTrades].filter(
      (offer) => offer.takerGets.length === 1 && offer.makerGets[0]?.resourceId === ResourcesIds.Lords,
    );
  }, [allTrades]);

  return {
    userTrades,
    bidOffers,
    askOffers,
  };
}
