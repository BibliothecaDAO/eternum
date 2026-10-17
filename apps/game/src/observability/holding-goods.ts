import { getActiveGameStore } from "@/sync/active-game-client";
import { readActivePlayerStructures, readFactView, resourceArrivalsView } from "@/sync/fact-views";
import { ResourceManager } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, type ResourcesIds } from "@bibliothecadao/types";

interface HoldingGoodsWindow {
  __eternumHoldingGoods?: (resource: ResourcesIds) => Record<number, number>;
}

/**
 * Each of the viewer's holdings' stock of one good as the game's facts hold it, in whole units: its stored balance and
 * what is on the road to it. A delivery that lands only moves goods from one to the other, so a holding's stock grows
 * by what was sent to it however its deliveries merge and land. For checks that follow a transfer's goods to every
 * destination (the game proof's transfer tasks). Read it as `window.__eternumHoldingGoods(resourceId)`.
 */
export const installHoldingGoodsReader = (): void => {
  if (typeof window === "undefined") return;
  (window as typeof window & HoldingGoodsWindow).__eternumHoldingGoods = readHoldingGoods;
};

const readHoldingGoods = (resource: ResourcesIds): Record<number, number> => {
  const store = getActiveGameStore();
  if (!store) return {};
  const arrivals = readFactView(store, resourceArrivalsView);
  const stock: Record<number, number> = {};
  for (const holding of readActivePlayerStructures()) {
    const id = Number(holding.entityId);
    const held = Number(new ResourceManager(store, id).balance(resource) ?? 0n);
    const onTheRoad = arrivals
      .filter((arrival) => arrival.structureEntityId === id)
      .flatMap((arrival) => arrival.resources)
      .filter((line) => line.resourceId === resource)
      .reduce((total, line) => total + line.amount, 0);
    stock[id] = Math.floor((held + onTheRoad) / RESOURCE_PRECISION);
  }
  return stock;
};
