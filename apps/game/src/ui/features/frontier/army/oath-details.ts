import { nativeOathConstants as oaths, nativeRuleConstants as rules } from "@bibliothecadao/eternum/game-client";
import { layerName, orders } from "@bibliothecadao/types";

export function oathName(id: number): string {
  const order = orders.find(({ orderId }) => orderId === id);
  if (!order || id === 0) throw new Error(`Unknown Oath ${id}`);
  return order.orderName;
}

export function oathEffectDescription(id: number): string | undefined {
  if (id === oaths.VITRIOL) return `Loses ${oaths.VITRIOL_LOSS_PER_TICK} troops a tick in the ${layerName(3)}.`;
  if (id === oaths.POWER) return `Deals ${oaths.POWER_DAMAGE_PERCENT}% more damage.`;
  if (id === oaths.GIANTS) return `Takes ${oaths.GIANTS_REDUCTION_PERCENT}% less damage.`;
  if (id === oaths.PROTECTION) return `Guarding a site, takes ${oaths.PROTECTION_REDUCTION_PERCENT}% less damage.`;
  if (id === oaths.REFLECTION)
    return `A well refills ${oaths.REFLECTION_WELL_PERCENT}% of the stamina bar, not ${rules.WELL_REFILL_PERCENT}%.`;
  return undefined;
}
