import { nativeOathConstants as oaths, nativeRuleConstants as rules } from "@bibliothecadao/eternum/game-client";
import { catalogOrder, layerName } from "@bibliothecadao/types";

export function oathName(id: number): string {
  if (id === 0) throw new Error(`Unknown Oath ${id}`);
  return catalogOrder(id).orderName;
}

export function oathEffectDescription(id: number): string {
  if (id === oaths.VITRIOL) return `Loses ${oaths.VITRIOL_LOSS_PER_TICK} troops a tick in the ${layerName(3)}.`;
  if (id === oaths.POWER) return `Deals ${oaths.POWER_DAMAGE_PERCENT}% more damage.`;
  if (id === oaths.GIANTS) return `Takes ${oaths.GIANTS_REDUCTION_PERCENT}% less damage.`;
  if (id === oaths.PROTECTION) return `Guarding a site, takes ${oaths.PROTECTION_REDUCTION_PERCENT}% less damage.`;
  if (id === oaths.REFLECTION)
    return `A well refills ${oaths.REFLECTION_WELL_PERCENT}% of the stamina bar, not ${rules.WELL_REFILL_PERCENT}%.`;
  if (id === oaths.DETECTION) return `Reveals find something ${oaths.DETECTION_FIND_PERCENT - 100}% more often.`;
  if (id === oaths.BRILLIANCE) return `Reveals pay ${oaths.BRILLIANCE_PAY_PERCENT - 100}% more.`;
  if (id === oaths.RAGE) return `Beaten guards pay ${oaths.RAGE_PAY_PERCENT - 100}% more.`;
  if (id === oaths.ANGER) return `An attack costs ${oaths.ANGER_ATTACK_STAMINA} stamina.`;
  if (id === oaths.TITANS)
    return `+${oaths.TITANS_STAMINA} stamina now, and the stamina bar holds ${oaths.TITANS_STAMINA} more.`;
  if (id === oaths.ENLIGHTENMENT)
    return `Regains ${Math.round(oaths.ENLIGHTENMENT_REGEN_BPS / 100) - 100}% more stamina each hour.`;
  if (id === oaths.FOX) return `A reveal costs ${oaths.FOX_REVEAL_DISCOUNT_PERCENT}% less stamina.`;
  if (id === oaths.SKILL)
    return `Deals ${oaths.SKILL_DAMAGE_PERCENT}% more on the attack that leaves its stamina under ${oaths.SKILL_BELOW_STAMINA}.`;
  if (id === oaths.FURY)
    return `An attack that beats its target gives back ${oaths.FURY_REFUND_PERCENT}% of the stamina it cost.`;
  if (id === oaths.TWINS)
    return `Your largest army beside it adds ${oaths.TWINS_DAMAGE_PERCENT}% of its own damage to each attack.`;
  if (id === oaths.PERFECTION)
    return `A guard beaten with under ${oaths.PERFECTION_LOSS_PERCENT}% of the army lost pays ${oaths.PERFECTION_PAY_PERCENT - 100}% more.`;
  throw new Error(`Unknown Oath ${id}`);
}
