import { computeTrades, ContractAddress, ResourcesIds } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo, usePlayerRealms } from "../";

export function useMarket(currentBlockTimestamp: number) {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const playerRealms = usePlayerRealms(ContractAddress(account.address));

  const allMarket = useEntityQuery([
    HasValue(components.Status, { value: 0n }),
    HasValue(components.Trade, { taker_id: 0 }),
  ]);
  const allTrades = useMemo(() => {
    return computeTrades(allMarket, currentBlockTimestamp, components);
  }, [allMarket]);

  const userTrades = useMemo(() => {
    return allTrades.filter((trade) => playerRealms.map((realm) => realm.entity_id).includes(trade.makerId));
  }, [allTrades]);

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
