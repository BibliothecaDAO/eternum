import { HasValue, getComponentValue, runQuery, Entity, NotValue } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { MarketInterface, Resource } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "../../ui/utils/utils";
import { calculateRatio } from "../../ui/components/cityview/realm/trade/Market/MarketOffer";
import { SortInterface } from "../../ui/elements/SortButton";
import useBlockchainStore from "../store/useBlockchainStore";
import useMarketStore, { isLordsMarket } from "../store/useMarketStore";
import { useEntityQuery } from "@dojoengine/react";
import { useEntities } from "./useEntities";

type TradeResourcesFromViewpoint = {
  resourcesGet: Resource[];
  resourcesGive: Resource[];
};

type TradeResources = {
  takerGets: Resource[];
  makerGets: Resource[];
};

export function useTrade() {
  const {
    setup: {
      components: { Resource, Trade, Realm, DetachedResource },
    },
  } = useDojo();

  const getDetachedResources = (entityId: bigint): Resource[] => {
    let resources = [];
    let index = 0n;
    let detachedResource = getComponentValue(DetachedResource, getEntityIdFromKeys([entityId, index]));
    while (detachedResource) {
      resources.push({ resourceId: detachedResource.resource_type, amount: Number(detachedResource.resource_amount) });
      index++;
      detachedResource = getComponentValue(DetachedResource, getEntityIdFromKeys([entityId, index]));
    }
    return resources;
  };

  const getTradeResources = (tradeId: bigint): TradeResources => {
    let trade = getComponentValue(Trade, getEntityIdFromKeys([BigInt(tradeId)]));

    if (!trade) return { takerGets: [], makerGets: [] };

    let takerGets = getDetachedResources(trade.maker_gives_resources_id);

    let makerGets = getDetachedResources(trade.taker_gives_resources_id);

    return { takerGets, makerGets };
  };

  const getTradeResourcesFromEntityViewpoint = (entityId: bigint, tradeId: bigint): TradeResourcesFromViewpoint => {
    let trade = getComponentValue(Trade, getEntityIdFromKeys([BigInt(tradeId)]));

    if (!trade) return { resourcesGet: [], resourcesGive: [] };

    let resourcesGet =
      trade.maker_id === entityId
        ? getDetachedResources(trade.taker_gives_resources_id)
        : getDetachedResources(trade.maker_gives_resources_id);

    let resourcesGive =
      trade.maker_id === entityId
        ? getDetachedResources(trade.maker_gives_resources_id)
        : getDetachedResources(trade.taker_gives_resources_id);

    return { resourcesGet, resourcesGive };
  };

  function computeTrades(entityIds: Entity[], nextBlockTimestamp: number) {
    const trades = entityIds
      .map((id) => {
        let trade = getComponentValue(Trade, id);
        if (trade) {
          const { takerGets, makerGets } = getTradeResources(trade.trade_id);
          const makerRealm = getComponentValue(Realm, getEntityIdFromKeys([trade.maker_id]));
          if (trade.expires_at > nextBlockTimestamp) {
            return {
              tradeId: trade.trade_id,
              makerId: trade.maker_id,
              takerId: trade.taker_id,
              makerOrder: makerRealm?.order,
              expiresAt: trade.expires_at,
              takerGets,
              makerGets,
              ratio: calculateRatio(makerGets, takerGets),
            } as MarketInterface;
          }
        }
      })
      .filter(Boolean) as MarketInterface[];
    return trades;
  }

  const canAcceptOffer = ({
    realmEntityId,
    resourcesGive,
  }: {
    realmEntityId: bigint;
    resourcesGive: Resource[];
  }): boolean => {
    let canAccept = true;
    Object.values(resourcesGive).forEach((resource) => {
      const realmResource = getComponentValue(
        Resource,
        getEntityIdFromKeys([realmEntityId, BigInt(resource.resourceId)]),
      );
      if (realmResource === undefined || realmResource.balance < resource.amount) {
        canAccept = false;
      }
    });
    return canAccept;
  };

  return {
    getTradeResources,
    getTradeResourcesFromEntityViewpoint,
    canAcceptOffer,
    computeTrades,
  };
}

export function useGetMyOffers(): MarketInterface[] {
  const {
    setup: {
      components: { Status, Trade },
    },
  } = useDojo();

  const { computeTrades } = useTrade();

  const { realmEntityId } = useRealmStore();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const [myOffers, setMyOffers] = useState<MarketInterface[]>([]);

  const entityIds = useEntityQuery([HasValue(Status, { value: 0n }), HasValue(Trade, { maker_id: realmEntityId })]);

  useMemo((): any => {
    if (!nextBlockTimestamp) return;
    const trades = computeTrades(entityIds, nextBlockTimestamp);
    setMyOffers(trades);
    // only recompute when different number of orders
  }, [entityIds, nextBlockTimestamp]);

  return myOffers;
}

export function useSetMarket() {
  const {
    setup: {
      components: { Status, Trade },
    },
  } = useDojo();

  const { playerRealms } = useEntities();
  const realmEntityIds = playerRealms().map((realm: any) => realm.entity_id);
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const refresh = useMarketStore((state) => state.refresh);
  const setRefresh = useMarketStore((state) => state.setRefresh);
  const [isComputed, setIsComputed] = useState(false);
  const { computeTrades } = useTrade();
  const setMarkets = useMarketStore((state) => state.setMarkets);

  // note: market should only be computed once at the beginning and can be reloaded
  useEffect(() => {
    if ((nextBlockTimestamp && realmEntityIds.length > 0 && !isComputed) || refresh) {
      const entityIds = Array.from(runQuery([HasValue(Status, { value: 0n }), HasValue(Trade, { taker_id: 0n })]));
      // comptue trades and filter out player trades
      const trades = computeTrades(entityIds, nextBlockTimestamp!).filter(
        (trade) => !realmEntityIds.includes(trade.makerId),
      );
      const generalMarket = trades.filter((order) => !isLordsMarket(order));
      const lordsMarket = trades.filter((order) => isLordsMarket(order));
      setMarkets([...generalMarket], [...lordsMarket]);
      setIsComputed(true);
      setRefresh(false);
    }
  }, [nextBlockTimestamp, realmEntityIds, refresh]);
}

export function useSetDirectOffers() {
  const {
    setup: {
      components: { Status, Trade },
    },
  } = useDojo();

  const { computeTrades } = useTrade();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const setDirectOffers = useMarketStore((state) => state.setDirectOffers);

  const entityIds = useEntityQuery([HasValue(Status, { value: 0n }), HasValue(Trade, { taker_id: realmEntityId })]);

  useEffect(() => {
    if (!nextBlockTimestamp) return;
    const trades = computeTrades(entityIds, nextBlockTimestamp);
    setDirectOffers(trades);
  }, [entityIds, nextBlockTimestamp]);
}

/**
 * sort trades based on active filters
 */
export function sortTrades(trades: MarketInterface[], _activeSort: SortInterface): MarketInterface[] {
  // todo: find a way to sort even though not in marketinterface anymore

  // if (activeSort.sort !== "none") {
  //   if (activeSort.sortKey === "ratio") {
  //     return trades.sort((a, b) => {
  //       if (activeSort.sort === "asc") {
  //         return a.ratio - b.ratio;
  //       } else {
  //         return b.ratio - a.ratio;
  //       }
  //     });
  //   } else if (activeSort.sortKey === "time") {
  //     return trades.sort((a, b) => {
  //       if (activeSort.sort === "asc") {
  //         return a.expiresAt - b.expiresAt;
  //       } else {
  //         return b.expiresAt - a.expiresAt;
  //       }
  //     });
  //   } else if (activeSort.sortKey === "distance") {
  //     return trades.sort((a, b) => {
  //       if (activeSort.sort === "asc") {
  //         return a.distance - b.distance;
  //       } else {
  //         return b.distance - a.distance;
  //       }
  //     });
  //   } else if (activeSort.sortKey === "realm") {
  //     return trades.sort((a, b) => {
  //       if (activeSort.sort === "asc") {
  //         return Number(a.makerId - b.makerId);
  //       } else {
  //         return Number(b.makerId - a.makerId);
  //       }
  //     });
  //   } else {
  //     return trades;
  //   }
  // } else {
  //   return trades.sort((a, b) => Number(b!.tradeId - a!.tradeId));
  // }
  return trades;
}
