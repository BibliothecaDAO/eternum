import {
  EntityIndex,
  HasValue,
  NotValue,
  getComponentValue,
} from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { Resource } from "../../types";
import {
  MarketInterface,
  ResourceInterface,
} from "../graphql/useGraphQLQueries";
import { useEffect, useMemo, useState } from "react";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "../../utils/utils";
import { useEntityQuery } from "@dojoengine/react";
import { HIGH_ENTITY_ID } from "../../dojo/createOptimisticSystemCalls";

export function useTrade() {
  const {
    setup: {
      components: { OrderResource, FungibleEntities },
    },
  } = useDojo();

  const getTradeResources = (orderId: number): Resource[] => {
    const fungibleEntities = getComponentValue(
      FungibleEntities,
      orderId as EntityIndex,
    );
    if (!fungibleEntities) return [];
    let resources: Resource[] = [];
    for (let i = 0; i < fungibleEntities.count; i++) {
      let entityId = getEntityIdFromKeys([
        BigInt(orderId),
        BigInt(fungibleEntities.key),
        BigInt(i),
      ]);
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

  return { getTradeResources };
}

// TODO: sorting here
export function useGetMyOffers() {
  const {
    setup: {
      components: { Status, Trade },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  const [myOffers, setMyOffers] = useState<MarketInterface[]>([]);

  const entityIds = useEntityQuery([
    HasValue(Status, { value: 0 }),
    HasValue(Trade, { maker_id: realmEntityId }),
  ]);

  useMemo(() => {
    const optimisticTradeId = entityIds.indexOf(HIGH_ENTITY_ID as EntityIndex);
    const trades = entityIds
      // avoid having optimistic and real trade at the same time
      .slice(
        0,
        optimisticTradeId === -1 ? entityIds.length + 1 : optimisticTradeId + 1,
      )
      .map((tradeId) => {
        let trade = getComponentValue(Trade, tradeId);
        if (trade) {
          return {
            tradeId,
            makerId: trade.maker_id,
            makerOrderId: trade.maker_order_id,
            takerOrderId: trade.taker_order_id,
            expiresAt: trade.expires_at,
          } as MarketInterface;
        }
      })
      .filter(Boolean)
      // TODO: change the sorting here
      .sort((a, b) => b!.tradeId - a!.tradeId) as MarketInterface[];
    setMyOffers(trades);
    // only recompute when different number of orders
  }, [entityIds]);

  return {
    myOffers,
  };
}

export function useGetMarket() {
  const {
    setup: {
      components: { Status, Trade },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  const [market, setMarket] = useState<MarketInterface[]>([]);

  const entityIds = useEntityQuery([
    HasValue(Status, { value: 0 }),
    NotValue(Trade, { maker_id: realmEntityId }),
  ]);

  useMemo(() => {
    const trades = entityIds
      .map((tradeId) => {
        let trade = getComponentValue(Trade, tradeId);
        if (trade) {
          return {
            tradeId,
            makerId: trade.maker_id,
            makerOrderId: trade.maker_order_id,
            takerOrderId: trade.taker_order_id,
            expiresAt: trade.expires_at,
          } as MarketInterface;
        }
      })
      .filter(Boolean)
      // TODO: change the sorting here
      .sort((a, b) => b!.tradeId - a!.tradeId) as MarketInterface[];
    setMarket(trades);
    // only recompute when different number of entities
  }, [entityIds]);

  return {
    market,
  };
}

export const useCanAcceptOffer = ({
  resourcesGive,
  realmEntityId,
}: {
  realmEntityId: number;
  resourcesGive: ResourceInterface[];
}) => {
  const {
    setup: {
      components: { Resource },
    },
  } = useDojo();

  const [canAccept, setCanAccept] = useState<boolean>(false);

  useEffect(() => {
    Object.values(resourcesGive).forEach((resource) => {
      const realmResource = getComponentValue(
        Resource,
        getEntityIdFromKeys([
          BigInt(realmEntityId),
          BigInt(resource.resourceId),
        ]),
      );
      if (realmResource?.balance && realmResource.balance >= resource.amount) {
        setCanAccept(true);
      }
    });
  }, [resourcesGive]);

  return canAccept;
};
