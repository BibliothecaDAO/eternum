import { nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
import { layerName, orders } from "@bibliothecadao/types";

export function oathName(id: number): string {
  const order = orders.find(({ orderId }) => orderId === id);
  if (!order || id === 0) throw new Error(`Unknown Oath ${id}`);
  return order.orderName;
}

export function oathEffectDescription(id: number): string | undefined {
  if (id === oaths.VITRIOL) return `Loses ${oaths.VITRIOL_LOSS_PER_TICK} troops a tick in the ${layerName(3)}.`;
  return undefined;
}
