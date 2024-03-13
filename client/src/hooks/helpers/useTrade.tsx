import { HasValue, getComponentValue, runQuery, Entity } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { MarketInterface, Resource } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "../../utils/utils";
import { HIGH_ENTITY_ID } from "../../dojo/createOptimisticSystemCalls";
import { calculateRatio } from "../../components/cityview/realm/trade/Market/MarketOffer";
import { SortInterface } from "../../elements/SortButton";
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
      components: { Resource, Trade, Realm, ResourceChest, DetachedResource },
    },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const getChestResources = (resourcesChestId: bigint): Resource[] => {
    const resourcesChest = getComponentValue(ResourceChest, getEntityIdFromKeys([resourcesChestId]));
    if (!resourcesChest) return [];
    let resources: Resource[] = [];
    let { resources_count } = resourcesChest;
    for (let i = 0; i < resources_count; i++) {
      let entityId = getEntityIdFromKeys([resourcesChestId, BigInt(i)]);
      const resource = getComponentValue(DetachedResource, entityId);
      if (resource) {
        resources.push({
          resourceId: resource.resource_type,
          amount: Number(resource.resource_amount),
        });
      }
    }
    return resources;
  };

  const getTradeResourcesFromTakerViewpoint = (tradeId: bigint): TradeResourcesFromViewpoint => {
    let trade = getComponentValue(Trade, getEntityIdFromKeys([BigInt(tradeId)]));

    if (!trade) return { resourcesGet: [], resourcesGive: [] };

    let resourcesGet = getChestResources(trade.taker_resource_chest_id);

    let resourcesGive = getChestResources(trade.maker_resource_chest_id);

    return { resourcesGet, resourcesGive };
  };

  const getTradeResources = (tradeId: bigint): TradeResources => {
    let trade = getComponentValue(Trade, getEntityIdFromKeys([BigInt(tradeId)]));

    if (!trade) return { takerGets: [], makerGets: [] };

    let takerGets = getChestResources(trade.taker_resource_chest_id);

    let makerGets = getChestResources(trade.maker_resource_chest_id);

    return { takerGets, makerGets };
  };

  const getTradeResourcesFromEntityViewpoint = (entityId: bigint, tradeId: bigint): TradeResourcesFromViewpoint => {
    let trade = getComponentValue(Trade, getEntityIdFromKeys([BigInt(tradeId)]));

    if (!trade) return { resourcesGet: [], resourcesGive: [] };

    let resourcesGet =
      trade.maker_id === entityId
        ? getChestResources(trade.maker_resource_chest_id)
        : getChestResources(trade.taker_resource_chest_id);

    let resourcesGive =
      trade.maker_id === entityId
        ? getChestResources(trade.taker_resource_chest_id)
        : getChestResources(trade.maker_resource_chest_id);

    return { resourcesGet, resourcesGive };
  };

  const getTradeIdFromResourcesChestId = (resourcesChestId: bigint): bigint | undefined => {
    const tradeIfMaker = Array.from(runQuery([HasValue(Trade, { maker_resource_chest_id: resourcesChestId })]));
    const tradeIfTaker = Array.from(runQuery([HasValue(Trade, { taker_resource_chest_id: resourcesChestId })]));
    if (tradeIfMaker.length > 0) {
      let trade = getComponentValue(Trade, tradeIfMaker[0]);
      return trade?.trade_id;
    } else if (tradeIfTaker.length > 0) {
      let trade = getComponentValue(Trade, tradeIfTaker[0]);
      return trade?.trade_id;
    } else {
      return undefined;
    }
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
    getTradeIdFromResourcesChestId,
    getChestResources,
    canAcceptOffer,
    computeTrades,
    getTradeResourcesFromTakerViewpoint,
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
    const optimisticTradeId = entityIds.indexOf(HIGH_ENTITY_ID.toString() as Entity);
    const trades = computeTrades(
      entityIds
        // avoid having optimistic and real trade at the same time
        .slice(0, optimisticTradeId === -1 ? entityIds.length + 1 : optimisticTradeId + 1),
    );
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

/**
 * sort trades based on active filters
 */
export function sortTrades(trades: MarketInterface[], activeSort: SortInterface): MarketInterface[] {
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
