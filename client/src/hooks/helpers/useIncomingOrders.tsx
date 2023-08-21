import {
  EntityIndex,
  getComponentValue,
  getEntitiesWithValue,
} from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import {
  IncomingOrderInfoInterface,
  IncomingOrderInterface,
} from "../graphql/useGraphQLQueries";
import { useEffect, useMemo, useState } from "react";
import useRealmStore from "../store/useRealmStore";
import { getEntitiesWithoutValue } from "../../utils/mud";
import { getEntityIdFromKeys } from "../../utils/utils";

export function useIncomingOrders() {
  const {
    setup: { components: { ArrivalTime, Position } },
  } = useDojo();

  const getIncomingOrderInfo = (
    orderId: number,
    counterpartyId: number,
  ): IncomingOrderInfoInterface | undefined => {
    const origin = getComponentValue(
      Position,
      getEntityIdFromKeys([BigInt(orderId)]),
    );
    const arrivalTime = getComponentValue(
      ArrivalTime,
      getEntityIdFromKeys([BigInt(counterpartyId)]),
    );
    if (origin && arrivalTime) {
      return {
        arrivalTime: arrivalTime.arrives_at,
        origin,
      };
    }
  };

  return { getIncomingOrderInfo };
}

export function useGetIncomingOrders() {
  const {
    setup: { components: { Trade } },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  const [incomingOrders, setIncomingOrders] = useState<
    IncomingOrderInterface[]
  >([]);
  const [entityIds, setEntityIds] = useState<EntityIndex[]>([]);

  useEffect(() => {
    const getEntities = () => {
      // get trades that have status 0 (open)
      const set1 = getEntitiesWithValue(Trade, {
        taker_id: realmEntityId,
        claimed_by_taker: 0 as any,
      });
      // get trades that have maker_id equal to realmEntityId
      const set2 = getEntitiesWithValue(Trade, {
        maker_id: realmEntityId,
        claimed_by_maker: 0 as any,
      });
      const set3 = getEntitiesWithoutValue(Trade, {
        maker_id: realmEntityId,
        taker_id: 0,
      });

      // only keep trades that are in both sets and that have not a taker_id null (not taken yet)
      const entityIds = Array.from(set1)
        .concat(Array.from(set2))
        .filter((value) => set3.has(value));
      setEntityIds(entityIds);
    };
    getEntities();
    const intervalId = setInterval(getEntities, 1000); // run every second
    return () => {
      clearInterval(intervalId); // Clear interval on component unmount
    };
  }, [realmEntityId]);

  useMemo(() => {
    const incomingOrders = entityIds
      .map((id) => {
        let entity = getComponentValue(Trade, id);
        if (entity) {
          return {
            orderId: entity.taker_order_id,
            counterPartyOrderId: entity.maker_order_id,
            claimed: false,
            tradeId: id,
          } as IncomingOrderInterface;
        }
      })
      .filter(Boolean) as IncomingOrderInterface[];
    setIncomingOrders(incomingOrders);
    // only recompute when different number of orders
  }, [entityIds.length]);

  return {
    incomingOrders,
  };
}
