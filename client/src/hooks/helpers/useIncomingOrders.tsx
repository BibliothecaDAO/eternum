import { EntityIndex, HasValue, getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import {
  IncomingOrderInfoInterface,
  IncomingOrderInterface,
} from "../graphql/useGraphQLQueries";
import { useEffect, useMemo, useState } from "react";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "../../utils/utils";
import { useEntityQuery } from "@dojoengine/react";

export function useIncomingOrders() {
  const {
    setup: {
      components: { ArrivalTime, Position },
    },
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
    setup: {
      components: { Trade, Status },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  const [incomingOrders, setIncomingOrders] = useState<
    IncomingOrderInterface[]
  >([]);
  const [entityIds, setEntityIds] = useState<EntityIndex[]>([]);

  const set1 = useEntityQuery([
    HasValue(Trade, {
      taker_id: realmEntityId,
      claimed_by_taker: 0 as any,
    }),
    // accepted
    HasValue(Status, { value: 1 }),
  ]);
  const set2 = useEntityQuery([
    HasValue(Trade, {
      maker_id: realmEntityId,
      claimed_by_maker: 0 as any,
    }),
    // accepted
    HasValue(Status, { value: 1 }),
  ]);

  useEffect(() => {
    const entityIds = Array.from(set1).concat(Array.from(set2));
    setEntityIds(entityIds);
  }, [set1, set2]);

  useMemo(() => {
    const incomingOrders = entityIds
      .map((id) => {
        let entity = getComponentValue(Trade, id);
        if (entity) {
          let isMaker = entity.maker_id === realmEntityId;
          return {
            orderId: isMaker ? entity.maker_order_id : entity.taker_order_id,
            counterPartyOrderId: isMaker
              ? entity.taker_order_id
              : entity.maker_order_id,
            claimed: false,
            tradeId: id,
          } as IncomingOrderInterface;
        }
      })
      .filter(Boolean)
      // TODO: manage sorting here
      .sort((a, b) => b!.tradeId - a!.tradeId) as IncomingOrderInterface[];
    setIncomingOrders(incomingOrders);
    // only recompute when different number of orders
  }, [entityIds.length]);

  return {
    incomingOrders,
  };
}
