import { Resource, Trade } from "@bibliothecadao/eternum";

export const getOrderIdsFromTrade = (
  trade: Trade,
  realmEntityId: number,
): { realmOrderId: number; counterpartyOrderId: number } | undefined => {
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
  return resources.reduce((total, resource) => total + (resource?.amount || 0) * 1, 0);
};
