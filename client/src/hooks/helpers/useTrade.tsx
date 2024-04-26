import { HasValue, getComponentValue, runQuery, Entity } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { MarketInterface, Resource } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "../../ui/utils/utils";
import { calculateRatio } from "../../ui/components/cityview/realm/trade/Market/MarketOffer";
import useBlockchainStore from "../store/useBlockchainStore";
import useMarketStore, { isLordsMarket } from "../store/useMarketStore";
import { useEntityQuery } from "@dojoengine/react";

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

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

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

  function computeTrades(entityIds: Entity[]) {
    const trades = entityIds
      .map((id) => {
        let trade = getComponentValue(Trade, id);
        if (trade) {
          const { takerGets, makerGets } = getTradeResources(trade.trade_id);
          const makerRealm = getComponentValue(Realm, getEntityIdFromKeys([trade.maker_id]));
          if (nextBlockTimestamp && trade.expires_at > nextBlockTimestamp) {
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

  const [myOffers, setMyOffers] = useState<MarketInterface[]>([]);

  const entityIds = useEntityQuery([HasValue(Status, { value: 0n }), HasValue(Trade, { maker_id: realmEntityId })]);

  useMemo((): any => {
    const trades = computeTrades(entityIds);
    setMyOffers(trades);
    // only recompute when different number of orders
  }, [entityIds]);

  return myOffers;
}

export function useSetMarket() {
  const {
    setup: {
      components: { Status, Trade },
    },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const refresh = useMarketStore((state) => state.refresh);
  const setRefresh = useMarketStore((state) => state.setRefresh);
  const [isComputed, setIsComputed] = useState(false);
  const { computeTrades } = useTrade();
  const setMarkets = useMarketStore((state) => state.setMarkets);

  // note: market should only be computed once at the beginning and can be reloaded
  useEffect(() => {
    if ((nextBlockTimestamp && !isComputed) || refresh) {
      const entityIds = Array.from(runQuery([HasValue(Status, { value: 0n }), HasValue(Trade, { taker_id: 0n })]));
      const trades = computeTrades(entityIds);
      const generalMarket = trades.filter((order) => !isLordsMarket(order));
      const lordsMarket = trades.filter((order) => isLordsMarket(order));
      setMarkets([...generalMarket], [...lordsMarket]);
      setIsComputed(true);
      setRefresh(false);
    }
  }, [nextBlockTimestamp, refresh]);
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
    const trades = computeTrades(entityIds);
    setDirectOffers(trades);
  }, [entityIds, nextBlockTimestamp]);
}
