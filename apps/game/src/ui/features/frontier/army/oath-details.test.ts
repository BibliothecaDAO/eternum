import { describe, expect, it } from "vitest";
import { oathBit } from "@bibliothecadao/eternum";
import {
  NativeFactStore,
  nativeOathConstants as oaths,
  nativeRuleConstants as rules,
} from "@bibliothecadao/eternum/game-client";
import { formatGain, formatPercent, formatRate, orders, RESOURCE_PRECISION, TroopType } from "@bibliothecadao/types";
import { PICK_EFFECT_WORDS as WORDS } from "@/ui/design-system/kit/words";
import release from "../../../../../../../contracts/l3/world-native/schema/release-definition.json";

import { readPickEffectBase } from "../pick-effect-text";
import { combatMarkOf } from "../sites/combat-mark";
import { oathEffectDescription, oathName, oathStatBadge } from "./oath-details";

const RULES = release.definition.rules;
const TROOPS = [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin] as const;

const store = new NativeFactStore();
store.applyFacts([
  { model: "SliceRules", key: "0x1", value: { ...RULES, game_id: 1 } },
  { model: "DeepRules", key: "0x2", value: { ...release.definition.economy.deep.Some, game_id: 1 } },
] as never);

const baseOf = (category: TroopType, held = 0) => readPickEffectBase(store, 1, { category, logistics: 0, oaths: held });
const card = (oath: number, category: TroopType, held = 0) => oathStatBadge(oath, baseOf(category, held));

const knightMax = RULES.troop_stamina_config.stamina_knight_max;
const reveal = RULES.troop_stamina_config.stamina_explore_stamina_cost;
const attack = RULES.troop_stamina_config.stamina_attack_req;
const deepLoss = Number(release.definition.economy.deep.Some.loss_per_tick) / RESOURCE_PRECISION;
const vitriolReduced = Math.floor((deepLoss * (100 - oaths.VITRIOL_REDUCTION_PERCENT)) / 100);
const baseStaminaPerSecond =
  RULES.troop_stamina_config.stamina_gain_per_tick / RULES.tick_config.armies_tick_in_seconds;
const enlightenmentStaminaPerSecond = baseStaminaPerSecond + oaths.ENLIGHTENMENT_REGEN_STAMINA / 3600;

const percent = (value: number) => formatPercent(value / 100);
const signed = (value: number) => formatPercent(value / 100, { signed: true });
const inReadingOrder = (text: string, figures: readonly string[]) => {
  let from = 0;
  for (const figure of figures) {
    const at = text.indexOf(figure, from);
    if (at === -1) return false;
    from = at + figure.length;
  }
  return true;
};

const CONDITIONS: Record<number, readonly string[]> = {
  [oaths.VITRIOL]: [WORDS.deepPoison],
  [oaths.POWER]: [],
  [oaths.GIANTS]: [],
  [oaths.PROTECTION]: [WORDS.damageTakenGuarding],
  [oaths.REFLECTION]: [],
  [oaths.DETECTION]: [WORDS.detectionUnit],
  [oaths.BRILLIANCE]: [],
  [oaths.RAGE]: [],
  [oaths.ANGER]: [],
  [oaths.TITANS]: [WORDS.titansMaxGain],
  [oaths.ENLIGHTENMENT]: [WORDS.oathStaminaRecovery],
  [oaths.FOX]: [],
  [oaths.SKILL]: [String(oaths.SKILL_BELOW_STAMINA)],
  [oaths.FURY]: [WORDS.furyRefund],
  [oaths.TWINS]: [WORDS.twinsDamage],
  [oaths.PERFECTION]: [percent(oaths.PERFECTION_LOSS_PERCENT)],
};

const FIGURES: Record<number, readonly string[]> = {
  [oaths.VITRIOL]: [String(deepLoss), String(vitriolReduced)],
  [oaths.POWER]: [signed(oaths.POWER_DAMAGE_PERCENT)],
  [oaths.GIANTS]: [signed(-oaths.GIANTS_REDUCTION_PERCENT)],
  [oaths.PROTECTION]: [signed(-oaths.PROTECTION_REDUCTION_PERCENT)],
  [oaths.REFLECTION]: [percent(rules.WELL_REFILL_PERCENT), percent(oaths.REFLECTION_WELL_PERCENT)],
  [oaths.DETECTION]: [String(oaths.DETECTION_EMPTY_REVEAL_LIMIT)],
  [oaths.BRILLIANCE]: [signed(oaths.BRILLIANCE_PAY_PERCENT - 100)],
  [oaths.RAGE]: [signed(oaths.RAGE_PAY_PERCENT - 100)],
  [oaths.ANGER]: [String(attack), String(oaths.ANGER_ATTACK_STAMINA)],
  [oaths.TITANS]: [formatGain(oaths.TITANS_STAMINA), String(knightMax), String(knightMax + oaths.TITANS_STAMINA)],
  [oaths.ENLIGHTENMENT]: [formatRate(baseStaminaPerSecond), formatRate(enlightenmentStaminaPerSecond)],
  [oaths.FOX]: [String(reveal), String(Math.floor((reveal * (100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT)) / 100))],
  [oaths.SKILL]: [signed(oaths.SKILL_DAMAGE_PERCENT)],
  [oaths.FURY]: [formatGain(Math.floor((attack * oaths.FURY_REFUND_PERCENT) / 100))],
  [oaths.TWINS]: [signed(oaths.TWINS_DAMAGE_PERCENT)],
  [oaths.PERFECTION]: [signed(oaths.PERFECTION_PAY_PERCENT - 100)],
};

describe("an Oath's card", () => {
  it("states every Oath's rule with its condition, for every troop type", () => {
    const named = orders.filter((order) => order.orderId > 0 && order.orderId <= 16).map((order) => order.orderId);
    expect(new Set(named).size).toBe(16);
    for (const oath of named)
      for (const category of TROOPS) {
        const { unit } = card(oath, category);
        const conditions = CONDITIONS[oath];
        expect(conditions, oathName(oath)).not.toBeUndefined();
        for (const condition of conditions!) expect(unit, `${oathName(oath)} for ${category}`).toContain(condition);
      }
  });

  it("shows each Oath's own compact figures with no em-dashes, and no two Oaths read alike", () => {
    const named = orders.filter((order) => order.orderId > 0 && order.orderId <= 16).map((order) => order.orderId);
    for (const oath of named) {
      const badge = card(oath, TroopType.Knight);
      const description = oathEffectDescription(oath, baseOf(TroopType.Knight));
      expect(badge.hero.length, oathName(oath)).toBeGreaterThan(0);
      expect(FIGURES[oath], oathName(oath)).not.toBeUndefined();
      expect(inReadingOrder(description, FIGURES[oath]!), oathName(oath)).toBe(true);
      expect(description).not.toContain("\u2014");
      expect(description).toBe(description.trim());
    }
    const texts = named.map((oath) => oathEffectDescription(oath, baseOf(TroopType.Knight)));
    expect(new Set(texts).size).toBe(named.length);
  });

  it("reads this army's own figures: a Scout's reveal, the Knight's maximum, the cost Anger leaves Fury", () => {
    expect(card(oaths.FOX, TroopType.Knight).hero).toBe(
      `${reveal} → ${Math.floor((reveal * (100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT)) / 100)}`,
    );
    expect(card(oaths.FOX, TroopType.Paladin).hero).toBe(
      `${rules.SCOUT_EXPLORE_STAMINA} → ${Math.floor((rules.SCOUT_EXPLORE_STAMINA * (100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT)) / 100)}`,
    );
    const titans = card(oaths.TITANS, TroopType.Knight).unit;
    for (const figure of [knightMax, knightMax + oaths.TITANS_STAMINA]) expect(titans).toContain(String(figure));
    expect(card(oaths.ANGER, TroopType.Knight).hero).toBe(`${attack} → ${oaths.ANGER_ATTACK_STAMINA}`);
    expect(card(oaths.FURY, TroopType.Knight).hero).toBe(`+${Math.floor((attack * oaths.FURY_REFUND_PERCENT) / 100)}`);
    expect(card(oaths.FURY, TroopType.Knight, oathBit(oaths.ANGER)).hero).toBe(
      `+${Math.floor((oaths.ANGER_ATTACK_STAMINA * oaths.FURY_REFUND_PERCENT) / 100)}`,
    );
    expect(card(oaths.VITRIOL, TroopType.Knight).hero).toBe(`${deepLoss} → ${vitriolReduced}`);
    expect(card(oaths.ENLIGHTENMENT, TroopType.Knight).hero).toBe(
      `${formatRate(baseStaminaPerSecond)} → ${formatRate(enlightenmentStaminaPerSecond)}`,
    );
    expect(card(oaths.ENLIGHTENMENT, TroopType.Knight).unit).toBe(WORDS.oathStaminaRecovery);
    expect(card(oaths.DETECTION, TroopType.Knight).hero).toBe(
      WORDS.detectionHero(String(oaths.DETECTION_EMPTY_REVEAL_LIMIT)),
    );
  });

  it("marks a combat Oath with the army's own class: Blade for Knights and Scouts, Bow for Crossbows", () => {
    for (const oath of [oaths.POWER, oaths.SKILL, oaths.TWINS])
      expect(TROOPS.map((category) => card(oath, category).icon)).toEqual(
        TROOPS.map((category) => combatMarkOf(category).icon),
      );
    expect(combatMarkOf(TroopType.Crossbowman).icon).not.toBe(combatMarkOf(TroopType.Knight).icon);
  });

  it("says in its tooltip exactly what the card says", () => {
    const { hero, unit } = card(oaths.SKILL, TroopType.Knight);
    expect(oathEffectDescription(oaths.SKILL, baseOf(TroopType.Knight))).toBe(`${hero} ${unit}`);
    const detection = card(oaths.DETECTION, TroopType.Knight);
    expect(oathEffectDescription(oaths.DETECTION, baseOf(TroopType.Knight))).toBe(
      `${detection.hero} ${detection.unit}`,
    );
    expect(() => oathStatBadge(17, baseOf(TroopType.Knight))).toThrow();
  });
});
