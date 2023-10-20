import { EntityIndex, HasValue, NotValue, getComponentValue, runQuery } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { Resource } from "../../types";
import { ResourceInterface } from "../graphql/useGraphQLQueries";
import { useEffect, useMemo, useState } from "react";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "../../utils/utils";
import { HIGH_ENTITY_ID } from "../../dojo/createOptimisticSystemCalls";
import { calculateRatio } from "../../components/cityview/realm/trade/Market/MarketOffer";
import { HasOrders, HasResources, QueryFragment, useTradeQuery } from "./useTradeQueries";
import { resources, orders } from "@bibliothecadao/eternum";
import { SortInterface } from "../../elements/SortButton";
import { useCaravan } from "./useCaravans";
import { getRealm } from "../../utils/realms";
import { useRoads } from "./useRoads";
import { BigNumberish } from "starknet";

export interface MarketInterface {
  tradeId: number;
  makerId: number;
  takerId: number;
  // brillance, reflection, ...
  makerOrder: number;
  makerOrderId: number;
  takerOrderId: number;
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

export function useTrade() {
  const {
    setup: {
      components: { OrderResource, FungibleEntities, Resource, Trade, Realm },
      optimisticSystemCalls: { optimisticClaimFungibleOrder },
      systemCalls: { claim_fungible_order },
    },
    account: { account },
  } = useDojo();

  const getTradeResources = (orderId: number): Resource[] => {
    const fungibleEntities = getComponentValue(FungibleEntities, orderId as EntityIndex);
    if (!fungibleEntities) return [];
    let resources: Resource[] = [];
    for (let i = 0; i < fungibleEntities.count; i++) {
      let entityId = getEntityIdFromKeys([BigInt(orderId), BigInt(fungibleEntities.key), BigInt(i)]);
      const resource = getComponentValue(OrderResource, entityId);
      if (resource) {
        resources.push({
          resourceId: resource.resource_type,
          amount: resource.balance,
        });
      }
    }
    return resources;
  };

  const getCounterpartyOrderId = (orderId: number): number | undefined => {
    const tradeIfMaker = Array.from(runQuery([HasValue(Trade, { maker_order_id: orderId })]));
    const tradeIfTaker = Array.from(runQuery([HasValue(Trade, { taker_order_id: orderId })]));
    if (tradeIfMaker.length > 0) {
      let trade = getComponentValue(Trade, tradeIfMaker[0]);
      return trade?.taker_order_id;
    } else if (tradeIfTaker.length > 0) {
      let trade = getComponentValue(Trade, tradeIfTaker[0]);
      return trade?.maker_order_id;
    } else {
      return undefined;
    }
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

  /* Claim Order
   * @param entity_id: entity id of realm
   * @param trade_id: id of the trade
   * @param [optimisticResourcesGet]: resources to display in case of optimistic rendering
   * @returns: void
   */
  const claimOrder = async (entity_id: BigNumberish, trade_id: BigNumberish, optimisticResourcesGet?: Resource[]) => {
    if (optimisticResourcesGet) {
      return await optimisticClaimFungibleOrder(
        optimisticResourcesGet,
        claim_fungible_order,
      )({
        signer: account,
        entity_id,
        trade_id,
      });
    }
    return await claim_fungible_order({
      signer: account,
      entity_id,
      trade_id,
    });
  };

  return { getTradeResources, getCounterpartyOrderId, canAcceptOffer, getRealmEntityIdFromRealmId, claimOrder };
}

export function useGetMyOffers({ selectedResources }: useGetMyOffersProps): MarketInterface[] {
  const {
    setup: {
      components: { Status, Trade, FungibleEntities, OrderResource },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  const [myOffers, setMyOffers] = useState<MarketInterface[]>([]);

  const fragments = useMemo(() => {
    const baseFragments: QueryFragment[] = [
      HasValue(Status, { value: 0 }),
      HasValue(Trade, { maker_id: realmEntityId }),
    ];

    if (selectedResources.length > 0)
      baseFragments.push(
        HasResources(
          Trade,
          FungibleEntities,
          OrderResource,
          selectedResources
            .map((resource) => resources.find((r) => r.trait === resource)?.id)
            .filter(Boolean) as number[],
        ),
      );

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
          const resourcesGet = getTradeResources(trade.taker_order_id);
          const resourcesGive = getTradeResources(trade.maker_order_id);
          const hasRoad = getHasRoad(realmEntityId, trade.taker_id);
          const distance = calculateDistance(trade.taker_id, realmEntityId);
          return {
            tradeId,
            makerId: trade.maker_id,
            takerId: trade.taker_id,
            makerOrder: getRealm(trade.maker_id).order,
            makerOrderId: trade.maker_order_id,
            takerOrderId: trade.taker_order_id,
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
      components: { Status, Trade, FungibleEntities, OrderResource, Realm },
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

    if (selectedResources.length > 0) {
      baseFragments.push(
        HasResources(
          Trade,
          FungibleEntities,
          OrderResource,
          selectedResources
            .map((resource) => resources.find((r) => r.trait === resource)?.id)
            .filter(Boolean) as number[],
        ),
      );
    }

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
          const resourcesGet = getTradeResources(trade.maker_order_id);
          const resourcesGive = getTradeResources(trade.taker_order_id);
          const distance = calculateDistance(trade.maker_id, realmEntityId);
          const hasRoad = getHasRoad(realmEntityId, trade.maker_id);
          return {
            tradeId,
            makerId: trade.maker_id,
            takerId: trade.taker_id,
            makerOrder: getRealm(trade.maker_id).order,
            makerOrderId: trade.maker_order_id,
            takerOrderId: trade.taker_order_id,
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
