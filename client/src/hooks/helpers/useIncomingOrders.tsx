import { EntityIndex, HasValue, getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { IncomingOrderInterface } from "../graphql/useGraphQLQueries";
import { useEffect, useMemo, useState } from "react";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "../../utils/utils";
import { useEntityQuery } from "@dojoengine/react";

export function useIncomingOrders() {
  const {
    setup: {
      components: { ArrivalTime, Position, Trade },
    },
  } = useDojo();

  const getIncomingOrderInfo = (realmEntityId: number, tradeId: EntityIndex): IncomingOrderInterface => {
    let trade = getComponentValue(Trade, tradeId);
    let isMaker = trade ? trade.maker_id === realmEntityId : undefined;
    const orderId = isMaker ? trade?.maker_order_id : trade?.taker_order_id;
    const counterPartyOrderId = isMaker ? trade?.taker_order_id : trade?.maker_order_id;
    const origin = orderId ? getComponentValue(Position, getEntityIdFromKeys([BigInt(orderId)])) : undefined;
    const position = counterPartyOrderId
      ? getComponentValue(Position, getEntityIdFromKeys([BigInt(counterPartyOrderId)]))
      : undefined;
    const arrivalTime = counterPartyOrderId
      ? getComponentValue(ArrivalTime, getEntityIdFromKeys([BigInt(counterPartyOrderId)]))
      : undefined;
    return {
      orderId,
      counterPartyOrderId,
      claimed: false,
      tradeId,
      arrivalTime: arrivalTime?.arrives_at,
      origin,
      position,
    };
  };

  return { getIncomingOrderInfo };
}

export function useGetIncomingOrders() {
  const {
    setup: {
      components: { Trade, Status, Position },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();
  const realmPosition = getComponentValue(Position, getEntityIdFromKeys([BigInt(realmEntityId)]));

  const [incomingOrders, setIncomingOrders] = useState<IncomingOrderInterface[]>([]);
  const [entityIds, setEntityIds] = useState<EntityIndex[]>([]);

  const { getIncomingOrderInfo } = useIncomingOrders();

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

  useMemo((): any => {
    const incomingOrders = entityIds
      .map((id) => {
        return getIncomingOrderInfo(realmEntityId, id);
      })
      .filter(Boolean)
      .filter((order) => order.position?.x === realmPosition?.x || order.position?.y === realmPosition?.y)
      // TODO: manage sorting here
      .sort((a, b) => b!.tradeId - a!.tradeId) as IncomingOrderInterface[];
    setIncomingOrders(incomingOrders);
    // only recompute when different number of orders
  }, [entityIds.length]);

  return {
    incomingOrders,
  };
}
