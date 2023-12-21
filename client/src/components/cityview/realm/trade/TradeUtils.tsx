import { Resource, Trade, WEIGHTS } from "@bibliothecadao/eternum";

export const getOrderIdsFromTrade = (
  trade: Trade,
  realmEntityId: bigint,
): { realmOrderId: bigint; counterpartyOrderId: bigint } | undefined => {
  return trade.maker_id === realmEntityId
    ? {
        realmOrderId: trade.maker_order_id,
        counterpartyOrderId: trade.taker_order_id,
      }
    : trade.taker_id === realmEntityId
    ? {
        realmOrderId: trade.taker_order_id,
        counterpartyOrderId: trade.maker_order_id,
      }
    : undefined;
};

export const getTotalResourceWeight = (resources: (Resource | undefined)[]) => {
  return resources.reduce(
    (total, resource) => total + (resource ? resource.amount * WEIGHTS[resource.resourceId] : 0),
    0,
  );
};
