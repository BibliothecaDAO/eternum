import { nativeOathConstants as oaths, nativeRuleConstants as rules } from "@bibliothecadao/eternum/game-client";
import {
  catalogOrder,
  formatCount,
  formatExact,
  formatGain,
  formatOrdinal,
  formatPercent,
} from "@bibliothecadao/types";
import type { IconMeaning } from "../../../design-system/icon-meaning";
import { PICK_EFFECT_WORDS } from "../../../design-system/kit/words";

import {
  damageDealtEffect,
  damageTakenEffect,
  fromToEffect,
  percentFromTo,
  staminaRecoveryEffect,
  type PickEffectBase,
} from "../pick-effect-format";

interface OathStatBadge {
  hero: string;
  unit: string;
  sub: string;
  icon: IconMeaning;
}

const foxRevealCosts = (base: PickEffectBase) => {
  if (base.revealStamina === undefined) return null;
  const scoutReveal = rules.SCOUT_EXPLORE_STAMINA;
  const keepPercent = 100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT;
  return {
    baseReveal: base.revealStamina,
    revealWith: Math.floor((base.revealStamina * keepPercent) / 100),
    scoutReveal,
    scoutWith: Math.floor((scoutReveal * keepPercent) / 100),
  };
};

const furyRefundAmount = (base: PickEffectBase) => {
  if (base.attackStamina === undefined) return null;
  return {
    attackStamina: base.attackStamina,
    refund: Math.floor((base.attackStamina * oaths.FURY_REFUND_PERCENT) / 100),
  };
};

const titansNextMax = (base: PickEffectBase) => {
  if (base.maxStamina === undefined) return null;
  return {
    baseMax: base.maxStamina,
    nextMax: base.maxStamina + oaths.TITANS_STAMINA,
  };
};

const enlightenmentBadge = (base: PickEffectBase): OathStatBadge => {
  const detail = staminaRecoveryEffect(base.staminaPerSecond, oaths.ENLIGHTENMENT_REGEN_BPS);
  const transition = detail.slice(`${PICK_EFFECT_WORDS.staminaRecovery}: `.length);
  const [, next] = transition.split(" → ");
  return {
    hero:
      base.staminaPerSecond !== undefined && next
        ? next
        : formatPercent((oaths.ENLIGHTENMENT_REGEN_BPS - 10_000) / 10_000, { signed: true }),
    unit: PICK_EFFECT_WORDS.staminaRecovery,
    sub: transition,
    icon: "stamina",
  };
};

export function oathName(id: number): string {
  if (id === 0) throw new Error(`Unknown Oath ${id}`);
  return catalogOrder(id).orderName;
}

export function oathStatBadge(id: number, base: PickEffectBase): OathStatBadge {
  if (id === oaths.VITRIOL) {
    const hero =
      base.deepLossPerTick !== undefined
        ? `${formatExact(base.deepLossPerTick)} → ${formatExact(oaths.VITRIOL_LOSS_PER_TICK)}`
        : formatExact(oaths.VITRIOL_LOSS_PER_TICK);
    return {
      hero,
      unit: PICK_EFFECT_WORDS.deepTroopLoss,
      sub: PICK_EFFECT_WORDS.perTick(formatExact(oaths.VITRIOL_LOSS_PER_TICK)),
      icon: "depth-1",
    };
  }
  if (id === oaths.POWER) {
    return {
      hero: formatPercent(oaths.POWER_DAMAGE_PERCENT / 100, { signed: true }),
      unit: PICK_EFFECT_WORDS.damageDealt,
      sub: `${formatPercent(1)} → ${formatPercent((100 + oaths.POWER_DAMAGE_PERCENT) / 100)}`,
      icon: "attack",
    };
  }
  if (id === oaths.GIANTS) {
    return {
      hero: formatPercent(-oaths.GIANTS_REDUCTION_PERCENT / 100, { signed: true }),
      unit: PICK_EFFECT_WORDS.damageTaken,
      sub: `${formatPercent(1)} → ${formatPercent((100 - oaths.GIANTS_REDUCTION_PERCENT) / 100)}`,
      icon: "defend",
    };
  }
  if (id === oaths.PROTECTION) {
    return {
      hero: formatPercent(-oaths.PROTECTION_REDUCTION_PERCENT / 100, { signed: true }),
      unit: PICK_EFFECT_WORDS.damageTaken,
      sub: PICK_EFFECT_WORDS.guardingSite,
      icon: "defend",
    };
  }
  if (id === oaths.REFLECTION) {
    return {
      hero: `${formatPercent(rules.WELL_REFILL_PERCENT / 100)} → ${formatPercent(oaths.REFLECTION_WELL_PERCENT / 100)}`,
      unit: PICK_EFFECT_WORDS.wellRefill,
      sub: formatPercent((oaths.REFLECTION_WELL_PERCENT - rules.WELL_REFILL_PERCENT) / 100, { signed: true }),
      icon: "well",
    };
  }
  if (id === oaths.DETECTION) {
    const emptyReveals = formatCount(oaths.DETECTION_EMPTY_REVEAL_LIMIT, "empty reveal");
    return {
      hero: formatOrdinal(oaths.DETECTION_EMPTY_REVEAL_LIMIT + 1),
      unit: emptyReveals,
      sub: PICK_EFFECT_WORDS.findAfter(emptyReveals),
      icon: "eye",
    };
  }
  if (id === oaths.BRILLIANCE) {
    return {
      hero: formatPercent((oaths.BRILLIANCE_PAY_PERCENT - 100) / 100, { signed: true }),
      unit: PICK_EFFECT_WORDS.exploreRewards,
      sub: `${formatPercent(1)} → ${formatPercent(oaths.BRILLIANCE_PAY_PERCENT / 100)}`,
      icon: "explore",
    };
  }
  if (id === oaths.RAGE) {
    return {
      hero: formatPercent((oaths.RAGE_PAY_PERCENT - 100) / 100, { signed: true }),
      unit: PICK_EFFECT_WORDS.siteAndGuardRewards,
      sub: `${formatPercent(1)} → ${formatPercent(oaths.RAGE_PAY_PERCENT / 100)}`,
      icon: "reward",
    };
  }
  if (id === oaths.ANGER) {
    const hero =
      base.attackStamina !== undefined
        ? `${formatExact(base.attackStamina)} → ${formatExact(oaths.ANGER_ATTACK_STAMINA)}`
        : formatExact(oaths.ANGER_ATTACK_STAMINA);
    return {
      hero,
      unit: PICK_EFFECT_WORDS.attackCost,
      sub: PICK_EFFECT_WORDS.staminaAmount(formatExact(oaths.ANGER_ATTACK_STAMINA)),
      icon: "stamina",
    };
  }
  if (id === oaths.TITANS) {
    const gain = formatGain(oaths.TITANS_STAMINA);
    const immediate = PICK_EFFECT_WORDS.staminaNow(gain);
    const max = titansNextMax(base);
    return {
      hero: gain,
      unit: PICK_EFFECT_WORDS.maxStamina,
      sub: max ? `${immediate} · ${formatExact(max.baseMax)} → ${formatExact(max.nextMax)}` : immediate,
      icon: "stamina",
    };
  }
  if (id === oaths.ENLIGHTENMENT) return enlightenmentBadge(base);
  if (id === oaths.FOX) {
    const fox = foxRevealCosts(base);
    if (!fox) {
      return {
        hero: formatPercent(-oaths.FOX_REVEAL_DISCOUNT_PERCENT / 100, { signed: true }),
        unit: PICK_EFFECT_WORDS.revealCost,
        sub: PICK_EFFECT_WORDS.less,
        icon: "stamina",
      };
    }
    return {
      hero: `${formatExact(fox.baseReveal)} → ${formatExact(fox.revealWith)}`,
      unit: PICK_EFFECT_WORDS.revealCost,
      sub: PICK_EFFECT_WORDS.scoutCostNote(formatExact(fox.scoutReveal), formatExact(fox.scoutWith)),
      icon: "stamina",
    };
  }
  if (id === oaths.SKILL) {
    return {
      hero: formatPercent(oaths.SKILL_DAMAGE_PERCENT / 100, { signed: true }),
      unit: PICK_EFFECT_WORDS.damageDealt,
      sub: PICK_EFFECT_WORDS.lowStaminaAttackDamage(formatExact(oaths.SKILL_BELOW_STAMINA)),
      icon: "attack",
    };
  }
  if (id === oaths.FURY) {
    const fury = furyRefundAmount(base);
    if (!fury) {
      return {
        hero: formatPercent(oaths.FURY_REFUND_PERCENT / 100),
        unit: PICK_EFFECT_WORDS.wonBattleRefund,
        sub: `${formatPercent(0)} → ${formatPercent(oaths.FURY_REFUND_PERCENT / 100)}`,
        icon: "stamina",
      };
    }
    return {
      hero: formatGain(fury.refund),
      unit: PICK_EFFECT_WORDS.wonBattleRefund,
      sub: PICK_EFFECT_WORDS.shareOf(formatPercent(oaths.FURY_REFUND_PERCENT / 100), formatExact(fury.attackStamina)),
      icon: "stamina",
    };
  }
  if (id === oaths.TWINS) {
    return {
      hero: formatPercent(oaths.TWINS_DAMAGE_PERCENT / 100, { signed: true }),
      unit: PICK_EFFECT_WORDS.nearbyAllyDamage,
      sub: `${formatPercent(0)} → ${formatPercent(oaths.TWINS_DAMAGE_PERCENT / 100)}`,
      icon: "people",
    };
  }
  if (id === oaths.PERFECTION) {
    return {
      hero: formatPercent((oaths.PERFECTION_PAY_PERCENT - 100) / 100, { signed: true }),
      unit: PICK_EFFECT_WORDS.cleanWinRewards(formatPercent(oaths.PERFECTION_LOSS_PERCENT / 100)),
      sub: `${formatPercent(1)} → ${formatPercent(oaths.PERFECTION_PAY_PERCENT / 100)}`,
      icon: "crown",
    };
  }
  throw new Error(`Unknown Oath ${id}`);
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
  if (id === oaths.DETECTION)
    return PICK_EFFECT_WORDS.findAfter(formatCount(oaths.DETECTION_EMPTY_REVEAL_LIMIT, "empty reveal"));
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
    const max = titansNextMax(base);
    if (!max) return `${immediate}; ${PICK_EFFECT_WORDS.maxStaminaGain(gain)}`;
    return `${immediate}; ${fromToEffect(
      PICK_EFFECT_WORDS.maxStamina,
      formatExact(max.baseMax),
      formatExact(max.nextMax),
    )}`;
  }
  if (id === oaths.ENLIGHTENMENT) return staminaRecoveryEffect(base.staminaPerSecond, oaths.ENLIGHTENMENT_REGEN_BPS);
  if (id === oaths.FOX) {
    const fox = foxRevealCosts(base);
    if (!fox)
      return percentFromTo(
        PICK_EFFECT_WORDS.revealCost,
        100,
        100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT,
        PICK_EFFECT_WORDS.less,
      );
    return fromToEffect(
      PICK_EFFECT_WORDS.revealCost,
      formatExact(fox.baseReveal),
      PICK_EFFECT_WORDS.staminaAmount(formatExact(fox.revealWith)),
      PICK_EFFECT_WORDS.scoutCostNote(formatExact(fox.scoutReveal), formatExact(fox.scoutWith)),
    );
  }
  if (id === oaths.SKILL)
    return percentFromTo(
      PICK_EFFECT_WORDS.lowStaminaAttackDamage(formatExact(oaths.SKILL_BELOW_STAMINA)),
      100,
      100 + oaths.SKILL_DAMAGE_PERCENT,
    );
  if (id === oaths.FURY) {
    const fury = furyRefundAmount(base);
    if (!fury) return percentFromTo(PICK_EFFECT_WORDS.wonBattleRefund, 0, oaths.FURY_REFUND_PERCENT);
    return fromToEffect(
      PICK_EFFECT_WORDS.wonBattleRefund,
      "0",
      PICK_EFFECT_WORDS.staminaAmount(formatExact(fury.refund)),
      PICK_EFFECT_WORDS.shareOf(formatPercent(oaths.FURY_REFUND_PERCENT / 100), formatExact(fury.attackStamina)),
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
