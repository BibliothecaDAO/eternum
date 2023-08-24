import {
  EntityIndex,
  HasValue,
  NotValue,
  getComponentValue,
  runQuery,
} from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { Resource } from "../../types";
import {
  MarketInterface,
  ResourceInterface,
} from "../graphql/useGraphQLQueries";
import { useEffect, useMemo, useRef, useState } from "react";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "../../utils/utils";

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

export function useGetMyOffers() {
  const {
    setup: {
      components: { Status, Trade },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  const [myOffers, setMyOffers] = useState<MarketInterface[]>([]);
  const [entityIds, setEntityIds] = useState<EntityIndex[]>([]);
  const previousEntityIds = useRef(entityIds);

  useEffect(() => {
    previousEntityIds.current = entityIds;
  });

  useEffect(() => {
    const getEntities = () => {
      // get trades that have status 0 (open)
      const entityIds = Array.from(
        runQuery([
          HasValue(Status, { value: 0 }),
          HasValue(Trade, { maker_id: realmEntityId }),
        ]),
      );
      entityIds.sort((a, b) => b - a);
      if (
        JSON.stringify(previousEntityIds.current) !== JSON.stringify(entityIds)
      ) {
        setEntityIds(entityIds);
      }
    };
    getEntities();
    const intervalId = setInterval(getEntities, 1000); // run every second
    return () => {
      clearInterval(intervalId); // Clear interval on component unmount
    };
  }, [realmEntityId]);

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
      .filter(Boolean) as MarketInterface[];
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
  const [entityIds, setEntityIds] = useState<EntityIndex[]>([]);

  const previousEntityIds = useRef(entityIds);

  useEffect(() => {
    previousEntityIds.current = entityIds;
  });

  useEffect(() => {
    const getEntities = () => {
      const entityIds = Array.from(
        runQuery([
          HasValue(Status, { value: 0 }),
          NotValue(Trade, { maker_id: realmEntityId }),
        ]),
      );
      entityIds.sort((a, b) => b - a);
      if (
        JSON.stringify(previousEntityIds.current) !== JSON.stringify(entityIds)
      ) {
        setEntityIds(entityIds);
      }
    };
    getEntities();
    const intervalId = setInterval(getEntities, 1000); // Fetch every second
    return () => {
      clearInterval(intervalId); // Clear interval on component unmount
    };
  }, [realmEntityId]);

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
      .filter(Boolean) as MarketInterface[];
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
