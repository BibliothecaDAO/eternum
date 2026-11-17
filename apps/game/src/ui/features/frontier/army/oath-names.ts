import { orders } from "@bibliothecadao/types";

export function oathName(id: number): string {
  const order = orders.find(({ orderId }) => orderId === id);
  if (!order || id === 0) throw new Error(`Unknown Oath ${id}`);
  return order.orderName;
}
