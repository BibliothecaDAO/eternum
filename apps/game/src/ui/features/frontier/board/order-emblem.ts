import { orders } from "@bibliothecadao/types";

/** A realm's Order as its emblem, the avatar that makes a row read as a realm; an Order the game lacks is loud. */
export const orderEmblem = (order: number): { art: string; name: string } => {
  const known = orders.find(({ orderId }) => orderId === order);
  if (!known) throw new Error(`No Order ${order}`);
  return { art: `/images/orders/${known.orderName.toLowerCase()}.png`, name: known.fullOrderName };
};
