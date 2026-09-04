import { MarketInterface } from "@bibliothecadao/types";

interface PendingOrdersResult {
  count: number;
  totalLordsLocked: number;
  orders: MarketInterface[];
}

export const filterPendingOrders = (
  bidOffers: MarketInterface[],
  askOffers: MarketInterface[],
  entityId: number,
): PendingOrdersResult => {
  const myBids = bidOffers.filter((o) => o.makerId === entityId);
  const myAsks = askOffers.filter((o) => o.makerId === entityId);
  const orders = [...myBids, ...myAsks];

  // Lords locked: in bid orders, maker gives Lords for a resource
  const totalLordsLocked = myBids.reduce((sum, o) => {
    const lordsAmount = o.makerGets[0]?.amount || 0;
    return sum + lordsAmount;
  }, 0);

  return { count: orders.length, totalLordsLocked, orders };
};
