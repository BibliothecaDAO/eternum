import { EntityIndex, HasValue, NotValue, getComponentValue, runQuery } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { Resource } from "../../types";
import { ResourceInterface } from "../graphql/useGraphQLQueries";
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

export interface MarketInterface {
  tradeId: number;
  makerId: number;
  takerId: number;
  // brillance, reflection, ...
  makerOrder: number;
  expiresAt: number;
  resourcesGet: Resource[];
  resourcesGive: Resource[];
  canAccept?: boolean;
  ratio: number;
  distance: number;
  hasRoad: boolean | undefined;
}

type useGetMarketProps = {
  selectedResources: string[];
  selectedOrders: string[];
  directOffers: boolean;
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

  const getChestResources = (resourcesChestId: number): Resource[] => {
    const resourcesChest = getComponentValue(ResourceChest, resourcesChestId as EntityIndex);
    if (!resourcesChest) return [];
    let resources: Resource[] = [];
    let { resources_count } = resourcesChest;
    for (let i = 0; i < resources_count; i++) {
      let entityId = getEntityIdFromKeys([BigInt(resourcesChestId), BigInt(i)]);
      const resource = getComponentValue(DetachedResource, entityId);
      if (resource) {
        resources.push({
          resourceId: resource.resource_type,
          amount: resource.resource_amount,
        });
      }
    }
    return resources;
  };

  const getTradeResources = (entityId: number, tradeId: number): TradeResources => {
    let trade = getComponentValue(Trade, getEntityIdFromKeys([BigInt(tradeId)]));

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

  const getTradeIdFromResourcesChestId = (resourcesChestId: number): number | undefined => {
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

  const getTradeIdFromTransportId = (transportId: number): number | undefined => {
    const makerTradeIds = runQuery([
      HasValue(Status, { value: 0 }),
      HasValue(Trade, { maker_transport_id: transportId }),
    ]);
    const takerTradeIds = runQuery([
      HasValue(Status, { value: 0 }),
      HasValue(Trade, { taker_transport_id: transportId }),
    ]);

    const tradeId = Array.from(new Set([...makerTradeIds, ...takerTradeIds]))[0];

    return tradeId;
  };

  const canAcceptOffer = ({
    realmEntityId,
    resourcesGive,
  }: {
    realmEntityId: number;
    resourcesGive: ResourceInterface[];
  }): boolean => {
    let canAccept = true;
    Object.values(resourcesGive).forEach((resource) => {
      const realmResource = getComponentValue(
        Resource,
        getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resource.resourceId)]),
      );
      if (realmResource === undefined || realmResource.balance < resource.amount) {
        canAccept = false;
      }
    });
    return canAccept;
  };

  const getRealmEntityIdFromRealmId = (realmId: number): number | undefined => {
    const realms = runQuery([HasValue(Realm, { realm_id: realmId })]);
    if (realms.size > 0) {
      return Number(realms.values().next().value);
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
      HasValue(Status, { value: 0 }),
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
    const optimisticTradeId = entityIds.indexOf(HIGH_ENTITY_ID as EntityIndex);
    const trades = entityIds
      // avoid having optimistic and real trade at the same time
      .slice(0, optimisticTradeId === -1 ? entityIds.length + 1 : optimisticTradeId + 1)
      .map((tradeId) => {
        let trade = getComponentValue(Trade, tradeId);
        if (trade) {
          const { resourcesGive, resourcesGet } = getTradeResources(realmEntityId, tradeId);
          const hasRoad = getHasRoad(realmEntityId, trade.taker_id);
          const distance = calculateDistance(trade.taker_id, realmEntityId);
          return {
            tradeId,
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
}: useGetMarketProps): MarketInterface[] {
  const {
    setup: {
      components: { Status, Trade, Realm },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const [market, setMarket] = useState<MarketInterface[]>([]);

  const fragments = useMemo(() => {
    const baseFragments: QueryFragment[] = [
      HasValue(Status, { value: 0 }),
      // cant be maker nor taker of the trade
      NotValue(Trade, { maker_id: realmEntityId }),
    ];

    if (directOffers) {
      baseFragments.push(HasValue(Trade, { taker_id: realmEntityId }));
    } else {
      baseFragments.push(HasValue(Trade, { taker_id: 0 }));
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
      .map((tradeId) => {
        let trade = getComponentValue(Trade, tradeId);
        if (trade) {
          const { resourcesGive, resourcesGet } = getTradeResources(realmEntityId, tradeId);
          const distance = calculateDistance(trade.maker_id, realmEntityId);
          const hasRoad = getHasRoad(realmEntityId, trade.maker_id);
          return {
            tradeId,
            makerId: trade.maker_id,
            takerId: trade.taker_id,
            makerOrder: getRealm(trade.maker_id).order,
            expiresAt: trade.expires_at,
            resourcesGet,
            resourcesGive,
            canAccept: canAcceptOffer({ realmEntityId, resourcesGive }),
            ratio: calculateRatio(resourcesGive, resourcesGet),
            distance: distance || 0,
            hasRoad,
          } as MarketInterface;
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
          return a.makerId - b.makerId;
        } else {
          return b.makerId - a.makerId;
        }
      });
    } else {
      return trades;
    }
  } else {
    return trades.sort((a, b) => b!.tradeId - a!.tradeId);
  }
}
