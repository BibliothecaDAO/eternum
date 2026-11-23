import { nativeOathConstants as oaths, nativeRuleConstants as rules } from "@bibliothecadao/eternum/game-client";
import {
  catalogOrder,
  formatCount,
  formatExact,
  formatGain,
  formatPercent,
  FRONTIER_TROOP_NAMES,
  layerName,
  TroopType,
} from "@bibliothecadao/types";

import {
  damageDealtEffect,
  damageTakenEffect,
  fromToEffect,
  insteadOfEffect,
  percentFromTo,
  staminaRecoveryEffect,
  type PickEffectBase,
} from "../pick-effect-text";

export function oathName(id: number): string {
  if (id === 0) throw new Error(`Unknown Oath ${id}`);
  return catalogOrder(id).orderName;
}

export function oathEffectDescription(id: number, base: PickEffectBase): string {
  if (id === oaths.VITRIOL) {
    const label = `${layerName(3)} troop loss`;
    if (base.deepLossPerTick === undefined) return `${label}: ${formatExact(oaths.VITRIOL_LOSS_PER_TICK)} per tick`;
    return fromToEffect(
      label,
      formatExact(base.deepLossPerTick),
      `${formatExact(oaths.VITRIOL_LOSS_PER_TICK)} per tick`,
      "less",
    );
  }
  if (id === oaths.POWER) return damageDealtEffect(oaths.POWER_DAMAGE_PERCENT);
  if (id === oaths.GIANTS) return damageTakenEffect(oaths.GIANTS_REDUCTION_PERCENT);
  if (id === oaths.PROTECTION) return damageTakenEffect(oaths.PROTECTION_REDUCTION_PERCENT, "guarding a site");
  if (id === oaths.REFLECTION)
    return percentFromTo("Well stamina refill", rules.WELL_REFILL_PERCENT, oaths.REFLECTION_WELL_PERCENT);
  if (id === oaths.DETECTION) {
    const next = formatCount(oaths.DETECTION_EMPTY_REVEAL_LIMIT, "reveal");
    if (base.emptyRevealLimit === undefined) return `Find something every ${next}`;
    return insteadOfEffect("Find something every", next, formatExact(base.emptyRevealLimit));
  }
  if (id === oaths.BRILLIANCE) return percentFromTo("Explore rewards", 100, oaths.BRILLIANCE_PAY_PERCENT);
  if (id === oaths.RAGE) return percentFromTo("Site and guard rewards", 100, oaths.RAGE_PAY_PERCENT);
  if (id === oaths.ANGER) {
    if (base.attackStamina === undefined) return `Attack cost: ${formatExact(oaths.ANGER_ATTACK_STAMINA)} stamina`;
    return fromToEffect(
      "Attack cost",
      formatExact(base.attackStamina),
      `${formatExact(oaths.ANGER_ATTACK_STAMINA)} stamina`,
      "less",
    );
  }
  if (id === oaths.TITANS) {
    const gain = formatGain(oaths.TITANS_STAMINA);
    const immediate = `${gain} stamina now`;
    if (base.maxStamina === undefined) return `${immediate}; ${gain} max stamina`;
    return `${immediate}; ${fromToEffect(
      "max stamina",
      formatExact(base.maxStamina),
      formatExact(base.maxStamina + oaths.TITANS_STAMINA),
    )}`;
  }
  if (id === oaths.ENLIGHTENMENT) return staminaRecoveryEffect(base.staminaPerSecond, oaths.ENLIGHTENMENT_REGEN_BPS);
  if (id === oaths.FOX) {
    if (base.revealStamina === undefined)
      return percentFromTo("Reveal cost", 100, 100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT, "less");
    const scoutReveal = rules.SCOUT_EXPLORE_STAMINA;
    const revealWith = Math.floor((base.revealStamina * (100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT)) / 100);
    const scoutWith = Math.floor((scoutReveal * (100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT)) / 100);
    return fromToEffect(
      "Reveal cost",
      formatExact(base.revealStamina),
      `${formatExact(revealWith)} stamina`,
      `${FRONTIER_TROOP_NAMES[TroopType.Paladin]} ${formatExact(scoutReveal)} → ${formatExact(scoutWith)}`,
    );
  }
  if (id === oaths.SKILL)
    return percentFromTo(
      `Low-stamina (<${formatExact(oaths.SKILL_BELOW_STAMINA)}) attack damage`,
      100,
      100 + oaths.SKILL_DAMAGE_PERCENT,
    );
  if (id === oaths.FURY) {
    if (base.attackStamina === undefined)
      return percentFromTo("Won battle stamina refund", 0, oaths.FURY_REFUND_PERCENT);
    const refund = Math.floor((base.attackStamina * oaths.FURY_REFUND_PERCENT) / 100);
    return fromToEffect(
      "Won battle stamina refund",
      "0",
      `${formatExact(refund)} stamina`,
      `${formatPercent(oaths.FURY_REFUND_PERCENT / 100)} of ${formatExact(base.attackStamina)}`,
    );
  }
  if (id === oaths.TWINS) return percentFromTo("Nearby ally bonus damage", 0, oaths.TWINS_DAMAGE_PERCENT);
  if (id === oaths.PERFECTION)
    return percentFromTo(
      `Clean-win (<${formatPercent(oaths.PERFECTION_LOSS_PERCENT / 100)} lost) rewards`,
      100,
      oaths.PERFECTION_PAY_PERCENT,
    );
  throw new Error(`Unknown Oath ${id}`);
}
