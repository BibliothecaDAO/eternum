import { HasValue, NotValue, getComponentValue, runQuery, Entity } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { MarketInterface, Resource } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "../../utils/utils";
import { HIGH_ENTITY_ID } from "../../dojo/createOptimisticSystemCalls";
import { calculateRatio } from "../../components/cityview/realm/trade/Market/MarketOffer";
import { HasOrders, QueryFragment, useTradeQuery } from "./useTradeQueries";
import { orders } from "@bibliothecadao/eternum";
import { SortInterface } from "../../elements/SortButton";
import { useCaravan } from "./useCaravans";
import { getRealm } from "../../utils/realms";
import { useRoads } from "./useRoads";
import useBlockchainStore from "../store/useBlockchainStore";

type useGetMarketProps = {
  selectedResources: string[];
  selectedOrders: string[];
  directOffers: boolean;
  filterOwnOffers: boolean;
};

type useGetMyOffersProps = {
  selectedResources: string[];
  selectedOrders: string[];
};

type TradeResources = {
  resourcesGet: Resource[];
  resourcesGive: Resource[];
};

export function useTrade() {
  const {
    setup: {
      components: { Resource, Trade, Realm, ResourceChest, DetachedResource, Status },
    },
  } = useDojo();

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

  const getTradeResources = (entityId: bigint, tradeId: bigint): TradeResources => {
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

  const getTradeIdFromTransportId = (transportId: bigint): bigint | undefined => {
    const makerTradeIds = runQuery([
      HasValue(Status, { value: 0n }),
      HasValue(Trade, { maker_transport_id: transportId }),
    ]);
    const takerTradeIds = runQuery([
      HasValue(Status, { value: 0n }),
      HasValue(Trade, { taker_transport_id: transportId }),
    ]);

    const tradeId = Array.from(new Set([...makerTradeIds, ...takerTradeIds]))[0];

    return BigInt(tradeId);
  };

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

  const getRealmEntityIdFromRealmId = (realmId: bigint): bigint | undefined => {
    const realmEntityIds = runQuery([HasValue(Realm, { realm_id: realmId })]);
    if (realmEntityIds.size > 0) {
      const realm = getComponentValue(Realm, realmEntityIds.values().next().value);
      return realm!.entity_id;
    }
  };

  return {
    getTradeResources,
    getTradeIdFromResourcesChestId,
    getChestResources,
    canAcceptOffer,
    getRealmEntityIdFromRealmId,
    getTradeIdFromTransportId,
  };
}

export function useGetMyOffers({ selectedResources }: useGetMyOffersProps): MarketInterface[] {
  const {
    setup: {
      components: { Status, Trade },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  const [myOffers, setMyOffers] = useState<MarketInterface[]>([]);

  const fragments = useMemo(() => {
    const baseFragments: QueryFragment[] = [
      HasValue(Status, { value: 0n }),
      HasValue(Trade, { maker_id: realmEntityId }),
    ];

    // TODO: create filters
    // if (selectedResources.length > 0)
    //   baseFragments.push(
    //     HasResources(
    //       Trade,
    //       FungibleEntities,
    //       OrderResource,
    //       selectedResources
    //         .map((resource) => resources.find((r) => r.trait === resource)?.id)
    //         .filter(Boolean) as number[],
    //     ),
    //   );

    return baseFragments;
  }, [selectedResources, realmEntityId]);

  const entityIds = useTradeQuery(fragments);

  const { getTradeResources } = useTrade();
  const { getHasRoad } = useRoads();
  const { calculateDistance } = useCaravan();

  useMemo((): any => {
    const optimisticTradeId = entityIds.indexOf(HIGH_ENTITY_ID.toString() as Entity);
    const trades = entityIds
      // avoid having optimistic and real trade at the same time
      .slice(0, optimisticTradeId === -1 ? entityIds.length + 1 : optimisticTradeId + 1)
      .map((id) => {
        let trade = getComponentValue(Trade, id);
        if (trade) {
          const { resourcesGive, resourcesGet } = getTradeResources(realmEntityId, trade.trade_id);
          const hasRoad = getHasRoad(realmEntityId, trade.taker_id);

          const distance = calculateDistance(trade.taker_id, realmEntityId);

          return {
            tradeId: trade.trade_id,
            makerId: trade.maker_id,
            takerId: trade.taker_id,
            makerOrder: getRealm(trade.maker_id).order,
            expiresAt: trade.expires_at,
            resourcesGet,
            resourcesGive,
            canAccept: false,
            hasRoad,
            ratio: calculateRatio(resourcesGive, resourcesGet),
            distance: distance || 0,
          } as MarketInterface;
        }
      })
      .filter(Boolean) as MarketInterface[];
    setMyOffers(trades);
    // only recompute when different number of orders
  }, [entityIds]);

  return myOffers;
}

export function useGetMarket({
  selectedResources,
  selectedOrders,
  directOffers,
  filterOwnOffers,
}: useGetMarketProps): MarketInterface[] {
  const {
    setup: {
      components: { Status, Trade, Realm },
    },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const [market, setMarket] = useState<MarketInterface[]>([]);

  const fragments = useMemo(() => {
    const baseFragments: QueryFragment[] = [HasValue(Status, { value: 0n })];

    if (directOffers) {
      baseFragments.push(HasValue(Trade, { taker_id: realmEntityId }));
    } else if (filterOwnOffers) {
      baseFragments.push(NotValue(Trade, { maker_id: realmEntityId }));
    } else {
      baseFragments.push(HasValue(Trade, { taker_id: 0n }));
    }

    if (selectedOrders.length > 0) {
      baseFragments.push(
        HasOrders(
          Trade,
          Realm,
          selectedOrders.map((order) => orders.find((o) => o.orderName === order)?.orderId) as number[],
        ),
      );
    }

    // if (selectedResources.length > 0) {
    //   baseFragments.push(
    //     HasResources(
    //       Trade,
    //       FungibleEntities,
    //       OrderResource,
    //       selectedResources
    //         .map((resource) => resources.find((r) => r.trait === resource)?.id)
    //         .filter(Boolean) as number[],
    //     ),
    //   );
    // }

    return baseFragments;
  }, [selectedOrders, selectedResources, realmEntityId]);

  const entityIds = useTradeQuery(fragments);

  const { getTradeResources, canAcceptOffer } = useTrade();
  const { calculateDistance } = useCaravan();
  const { getHasRoad } = useRoads();

  useEffect(() => {
    const trades = entityIds
      .map((id) => {
        let trade = getComponentValue(Trade, id);
        if (trade) {
          const isMine = trade.maker_id === realmEntityId;
          const { resourcesGive, resourcesGet } = getTradeResources(realmEntityId, trade.trade_id);
          const distance = calculateDistance(trade.maker_id, realmEntityId);
          const hasRoad = getHasRoad(realmEntityId, trade.maker_id);
          if (nextBlockTimestamp && trade.expires_at > nextBlockTimestamp) {
            return {
              tradeId: trade.trade_id,
              makerId: trade.maker_id,
              takerId: trade.taker_id,
              makerOrder: getRealm(trade.maker_id).order,
              expiresAt: trade.expires_at,
              resourcesGet: isMine ? resourcesGive : resourcesGet,
              resourcesGive: isMine ? resourcesGet : resourcesGive,
              canAccept: canAcceptOffer({ realmEntityId, resourcesGive }),
              ratio: isMine ? calculateRatio(resourcesGet, resourcesGive) : calculateRatio(resourcesGive, resourcesGet),
              distance: distance || 0,
              hasRoad,
            } as MarketInterface;
          }
        }
      })
      .filter(Boolean) as MarketInterface[];
    setMarket(trades);
  }, [entityIds]);

  return market;
}

/**
 * sort trades based on active filters
 */
export function sortTrades(trades: MarketInterface[], activeSort: SortInterface): MarketInterface[] {
  if (activeSort.sort !== "none") {
    if (activeSort.sortKey === "ratio") {
      return trades.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.ratio - b.ratio;
        } else {
          return b.ratio - a.ratio;
        }
      });
    } else if (activeSort.sortKey === "time") {
      return trades.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.expiresAt - b.expiresAt;
        } else {
          return b.expiresAt - a.expiresAt;
        }
      });
    } else if (activeSort.sortKey === "distance") {
      return trades.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.distance - b.distance;
        } else {
          return b.distance - a.distance;
        }
      });
    } else if (activeSort.sortKey === "realm") {
      return trades.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return Number(a.makerId - b.makerId);
        } else {
          return Number(b.makerId - a.makerId);
        }
      });
    } else {
      return trades;
    }
  } else {
    return trades.sort((a, b) => Number(b!.tradeId - a!.tradeId));
  }
}
