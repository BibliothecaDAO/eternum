import { nativeOathConstants as oaths, nativeRuleConstants as rules } from "@bibliothecadao/eternum/game-client";
import { catalogOrder, formatCount, formatExact, formatGain, formatPercent } from "@bibliothecadao/types";
import { PICK_EFFECT_WORDS } from "@/ui/design-system/kit/words";

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
    const label = PICK_EFFECT_WORDS.deepTroopLoss;
    const perTick = PICK_EFFECT_WORDS.perTick(formatExact(oaths.VITRIOL_LOSS_PER_TICK));
    if (base.deepLossPerTick === undefined) return `${label}: ${perTick}`;
    return fromToEffect(label, formatExact(base.deepLossPerTick), perTick, PICK_EFFECT_WORDS.less);
  }
  if (id === oaths.POWER) return damageDealtEffect(oaths.POWER_DAMAGE_PERCENT);
  if (id === oaths.GIANTS) return damageTakenEffect(oaths.GIANTS_REDUCTION_PERCENT);
  if (id === oaths.PROTECTION)
    return damageTakenEffect(oaths.PROTECTION_REDUCTION_PERCENT, PICK_EFFECT_WORDS.guardingSite);
  if (id === oaths.REFLECTION)
    return percentFromTo(PICK_EFFECT_WORDS.wellRefill, rules.WELL_REFILL_PERCENT, oaths.REFLECTION_WELL_PERCENT);
  if (id === oaths.DETECTION) {
    const next = formatCount(oaths.DETECTION_EMPTY_REVEAL_LIMIT, "reveal");
    if (base.emptyRevealLimit === undefined) return PICK_EFFECT_WORDS.findEvery(next);
    return insteadOfEffect(PICK_EFFECT_WORDS.findEveryLead, next, formatExact(base.emptyRevealLimit));
  }
  if (id === oaths.BRILLIANCE)
    return percentFromTo(PICK_EFFECT_WORDS.exploreRewards, 100, oaths.BRILLIANCE_PAY_PERCENT);
  if (id === oaths.RAGE) return percentFromTo(PICK_EFFECT_WORDS.siteAndGuardRewards, 100, oaths.RAGE_PAY_PERCENT);
  if (id === oaths.ANGER) {
    const cost = PICK_EFFECT_WORDS.staminaAmount(formatExact(oaths.ANGER_ATTACK_STAMINA));
    if (base.attackStamina === undefined) return `${PICK_EFFECT_WORDS.attackCost}: ${cost}`;
    return fromToEffect(PICK_EFFECT_WORDS.attackCost, formatExact(base.attackStamina), cost, PICK_EFFECT_WORDS.less);
  }
  if (id === oaths.TITANS) {
    const gain = formatGain(oaths.TITANS_STAMINA);
    const immediate = PICK_EFFECT_WORDS.staminaNow(gain);
    if (base.maxStamina === undefined) return `${immediate}; ${PICK_EFFECT_WORDS.maxStaminaGain(gain)}`;
    return `${immediate}; ${fromToEffect(
      PICK_EFFECT_WORDS.maxStamina,
      formatExact(base.maxStamina),
      formatExact(base.maxStamina + oaths.TITANS_STAMINA),
    )}`;
  }
  if (id === oaths.ENLIGHTENMENT) return staminaRecoveryEffect(base.staminaPerSecond, oaths.ENLIGHTENMENT_REGEN_BPS);
  if (id === oaths.FOX) {
    if (base.revealStamina === undefined)
      return percentFromTo(
        PICK_EFFECT_WORDS.revealCost,
        100,
        100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT,
        PICK_EFFECT_WORDS.less,
      );
    const scoutReveal = rules.SCOUT_EXPLORE_STAMINA;
    const revealWith = Math.floor((base.revealStamina * (100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT)) / 100);
    const scoutWith = Math.floor((scoutReveal * (100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT)) / 100);
    return fromToEffect(
      PICK_EFFECT_WORDS.revealCost,
      formatExact(base.revealStamina),
      PICK_EFFECT_WORDS.staminaAmount(formatExact(revealWith)),
      PICK_EFFECT_WORDS.scoutCostNote(formatExact(scoutReveal), formatExact(scoutWith)),
    );
  }
  if (id === oaths.SKILL)
    return percentFromTo(
      PICK_EFFECT_WORDS.lowStaminaAttackDamage(formatExact(oaths.SKILL_BELOW_STAMINA)),
      100,
      100 + oaths.SKILL_DAMAGE_PERCENT,
    );
  if (id === oaths.FURY) {
    if (base.attackStamina === undefined)
      return percentFromTo(PICK_EFFECT_WORDS.wonBattleRefund, 0, oaths.FURY_REFUND_PERCENT);
    const refund = Math.floor((base.attackStamina * oaths.FURY_REFUND_PERCENT) / 100);
    return fromToEffect(
      PICK_EFFECT_WORDS.wonBattleRefund,
      "0",
      PICK_EFFECT_WORDS.staminaAmount(formatExact(refund)),
      PICK_EFFECT_WORDS.shareOf(formatPercent(oaths.FURY_REFUND_PERCENT / 100), formatExact(base.attackStamina)),
    );
  }
  if (id === oaths.TWINS) return percentFromTo(PICK_EFFECT_WORDS.nearbyAllyDamage, 0, oaths.TWINS_DAMAGE_PERCENT);
  if (id === oaths.PERFECTION)
    return percentFromTo(
      PICK_EFFECT_WORDS.cleanWinRewards(formatPercent(oaths.PERFECTION_LOSS_PERCENT / 100)),
      100,
      oaths.PERFECTION_PAY_PERCENT,
    );
  throw new Error(`Unknown Oath ${id}`);
}
