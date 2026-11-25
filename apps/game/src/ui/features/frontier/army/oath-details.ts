import {
  oathAttackStamina,
  oathBit,
  oathDeepLossPerTick,
  oathExploreStamina,
  oathFuryRefund,
  oathRegenBps,
  oathStaminaBonus,
} from "@bibliothecadao/eternum";
import { nativeOathConstants as oaths, nativeRuleConstants as rules } from "@bibliothecadao/eternum/game-client";
import {
  catalogOrder,
  formatCount,
  formatDuration,
  formatExact,
  formatGain,
  formatOrdinal,
  formatPercent,
  formatRate,
  RESOURCE_PRECISION,
} from "@bibliothecadao/types";
import type { IconMeaning } from "../../../design-system/icon-meaning";
import { PICK_EFFECT_WORDS as WORDS } from "../../../design-system/kit/words";

import type { PickEffectBase } from "../pick-effect-format";
import { combatMarkOf } from "../sites/combat-mark";

interface OathStatBadge {
  hero: string;
  unit: string;
  icon: IconMeaning;
}

const signedPercent = (percent: number) => formatPercent(percent / 100, { signed: true });
const fromTo = (from: string, to: string) => `${from} → ${to}`;

const attackIcon = (base: PickEffectBase): IconMeaning =>
  base.category === undefined ? "attack" : combatMarkOf(base.category).icon;

const foxBadge = (base: PickEffectBase): OathStatBadge => ({
  hero:
    base.revealStamina === undefined
      ? signedPercent(-oaths.FOX_REVEAL_DISCOUNT_PERCENT)
      : fromTo(
          formatExact(base.revealStamina),
          formatExact(oathExploreStamina(oathBit(oaths.FOX), base.revealStamina)),
        ),
  unit: WORDS.revealTileStamina,
  icon: "stamina",
});

const angerBadge = (base: PickEffectBase): OathStatBadge => ({
  hero:
    base.attackStamina === undefined
      ? formatExact(oaths.ANGER_ATTACK_STAMINA)
      : fromTo(
          formatExact(base.attackStamina),
          formatExact(oathAttackStamina(oathBit(oaths.ANGER), base.attackStamina)),
        ),
  unit: WORDS.attackStaminaCost,
  icon: "stamina",
});

const furyBadge = (base: PickEffectBase): OathStatBadge => ({
  hero:
    base.attackStamina === undefined
      ? formatPercent(oaths.FURY_REFUND_PERCENT / 100)
      : formatGain(oathFuryRefund(oathBit(oaths.FURY), base.attackStamina)),
  unit: WORDS.furyRefund,
  icon: "stamina",
});

const titansBadge = (base: PickEffectBase): OathStatBadge => {
  const gain = formatGain(oathStaminaBonus(oathBit(oaths.TITANS)));
  return {
    hero: gain,
    unit:
      base.maxStamina === undefined
        ? WORDS.titansMaxGain(gain)
        : WORDS.titansMax(
            formatExact(base.maxStamina),
            formatExact(base.maxStamina + oathStaminaBonus(oathBit(oaths.TITANS))),
            gain,
          ),
    icon: "stamina",
  };
};

const enlightenmentBadge = (base: PickEffectBase): OathStatBadge => {
  const factor = oathRegenBps(oathBit(oaths.ENLIGHTENMENT)) / 10_000;
  return {
    hero: formatPercent(factor - 1, { signed: true }),
    unit:
      base.staminaPerSecond === undefined
        ? WORDS.staminaRecovery
        : WORDS.staminaRecoveryFromTo(formatRate(base.staminaPerSecond), formatRate(base.staminaPerSecond * factor)),
    icon: "stamina",
  };
};

const vitriolBadge = (base: PickEffectBase): OathStatBadge => {
  const loss = Number(oathDeepLossPerTick(oathBit(oaths.VITRIOL), 0n)) / RESOURCE_PRECISION;
  return {
    hero:
      base.deepLossPerTick === undefined
        ? formatExact(loss)
        : fromTo(formatExact(base.deepLossPerTick), formatExact(loss)),
    unit: base.tickSeconds === undefined ? WORDS.deepPoison : WORDS.deepPoisonEvery(formatDuration(base.tickSeconds)),
    icon: "depth-1",
  };
};

const OATH_BADGES: Record<number, (base: PickEffectBase) => OathStatBadge> = {
  [oaths.VITRIOL]: vitriolBadge,
  [oaths.POWER]: (base) => ({
    hero: signedPercent(oaths.POWER_DAMAGE_PERCENT),
    unit: WORDS.battleDamageDealt,
    icon: attackIcon(base),
  }),
  [oaths.GIANTS]: () => ({
    hero: signedPercent(-oaths.GIANTS_REDUCTION_PERCENT),
    unit: WORDS.battleDamageTaken,
    icon: "defend",
  }),
  [oaths.PROTECTION]: () => ({
    hero: signedPercent(-oaths.PROTECTION_REDUCTION_PERCENT),
    unit: WORDS.damageTakenGuarding,
    icon: "defend",
  }),
  [oaths.REFLECTION]: () => ({
    hero: fromTo(formatPercent(rules.WELL_REFILL_PERCENT / 100), formatPercent(oaths.REFLECTION_WELL_PERCENT / 100)),
    unit: WORDS.wellRefill,
    icon: "well",
  }),
  [oaths.DETECTION]: () => ({
    hero: WORDS.revealOrdinal(formatOrdinal(oaths.DETECTION_EMPTY_REVEAL_LIMIT + 1)),
    unit: WORDS.findAfter(formatCount(oaths.DETECTION_EMPTY_REVEAL_LIMIT, "empty reveal")),
    icon: "eye",
  }),
  [oaths.BRILLIANCE]: () => ({
    hero: signedPercent(oaths.BRILLIANCE_PAY_PERCENT - 100),
    unit: WORDS.revealRewards,
    icon: "explore",
  }),
  [oaths.RAGE]: () => ({
    hero: signedPercent(oaths.RAGE_PAY_PERCENT - 100),
    unit: WORDS.siteRewards,
    icon: "reward",
  }),
  [oaths.ANGER]: angerBadge,
  [oaths.TITANS]: titansBadge,
  [oaths.ENLIGHTENMENT]: enlightenmentBadge,
  [oaths.FOX]: foxBadge,
  [oaths.SKILL]: (base) => ({
    hero: signedPercent(oaths.SKILL_DAMAGE_PERCENT),
    unit: WORDS.skillDamage(formatExact(oaths.SKILL_BELOW_STAMINA)),
    icon: attackIcon(base),
  }),
  [oaths.FURY]: furyBadge,
  [oaths.TWINS]: (base) => ({
    hero: signedPercent(oaths.TWINS_DAMAGE_PERCENT),
    unit: WORDS.twinsDamage,
    icon: attackIcon(base),
  }),
  [oaths.PERFECTION]: () => ({
    hero: signedPercent(oaths.PERFECTION_PAY_PERCENT - 100),
    unit: WORDS.siteRewardsUnderLoss(formatPercent(oaths.PERFECTION_LOSS_PERCENT / 100)),
    icon: "crown",
  }),
};

export function oathName(id: number): string {
  if (id === 0) throw new Error(`Unknown Oath ${id}`);
  return catalogOrder(id).orderName;
}

export function oathStatBadge(id: number, base: PickEffectBase): OathStatBadge {
  const badge = OATH_BADGES[id];
  if (!badge) throw new Error(`Unknown Oath ${id}`);
  return badge(base);
}

export function oathEffectDescription(id: number, base: PickEffectBase): string {
  const { hero, unit } = oathStatBadge(id, base);
  return `${hero} ${unit}`;
}
