import { describe, expect, it } from "vitest";
import { oathBit } from "@bibliothecadao/eternum";
import {
  NativeFactStore,
  nativeOathConstants as oaths,
  nativeRuleConstants as rules,
} from "@bibliothecadao/eternum/game-client";
import { formatDuration, orders, RESOURCE_PRECISION, TroopType } from "@bibliothecadao/types";
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
const perMinute = (60 * RULES.troop_stamina_config.stamina_gain_per_tick) / RULES.tick_config.armies_tick_in_seconds;
const deepLoss = Number(release.definition.economy.deep.Some.loss_per_tick) / RESOURCE_PRECISION;
const cadence = formatDuration(RULES.tick_config.armies_tick_in_seconds);

const CONDITIONS: Record<number, string | null> = {
  [oaths.VITRIOL]: `every ${cadence}`,
  [oaths.POWER]: null,
  [oaths.GIANTS]: null,
  [oaths.PROTECTION]: "while guarding a site",
  [oaths.REFLECTION]: "at a Well",
  [oaths.DETECTION]: `after ${oaths.DETECTION_EMPTY_REVEAL_LIMIT} empty reveals`,
  [oaths.BRILLIANCE]: "Tile reveal",
  [oaths.RAGE]: "Cleared site",
  [oaths.ANGER]: null,
  [oaths.TITANS]: `+${oaths.TITANS_STAMINA} now`,
  [oaths.ENLIGHTENMENT]: null,
  [oaths.FOX]: "reveal a tile",
  [oaths.SKILL]: `under ${oaths.SKILL_BELOW_STAMINA} stamina left after`,
  [oaths.FURY]: "an attack defeats the enemy",
  [oaths.TWINS]: "on attack",
  [oaths.PERFECTION]: `under ${oaths.PERFECTION_LOSS_PERCENT}% troops`,
};

describe("an Oath's card", () => {
  it("states every Oath's rule with its condition, for every troop type", () => {
    const named = orders.filter((order) => order.orderId > 0 && order.orderId <= 16).map((order) => order.orderId);
    expect(new Set(named).size).toBe(16);
    for (const oath of named)
      for (const category of TROOPS) {
        const { unit } = card(oath, category);
        const condition = CONDITIONS[oath];
        expect(condition, oathName(oath)).not.toBeUndefined();
        if (condition) expect(unit, `${oathName(oath)} for ${category}`).toContain(condition);
      }
  });

  it("reads this army's own figures: a Scout's reveal, the Knight's maximum, the cost Anger leaves Fury", () => {
    expect(card(oaths.FOX, TroopType.Knight).hero).toBe(`${reveal} → ${Math.floor((reveal * (100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT)) / 100)}`);
    expect(card(oaths.FOX, TroopType.Paladin).hero).toBe(
      `${rules.SCOUT_EXPLORE_STAMINA} → ${Math.floor((rules.SCOUT_EXPLORE_STAMINA * (100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT)) / 100)}`,
    );
    expect(card(oaths.TITANS, TroopType.Knight).unit).toBe(
      `Max stamina (${knightMax} → ${knightMax + oaths.TITANS_STAMINA}) and +${oaths.TITANS_STAMINA} now`,
    );
    expect(card(oaths.ANGER, TroopType.Knight).hero).toBe(`${attack} → ${oaths.ANGER_ATTACK_STAMINA}`);
    expect(card(oaths.FURY, TroopType.Knight).hero).toBe(`+${Math.floor((attack * oaths.FURY_REFUND_PERCENT) / 100)}`);
    expect(card(oaths.FURY, TroopType.Knight, oathBit(oaths.ANGER)).hero).toBe(
      `+${Math.floor((oaths.ANGER_ATTACK_STAMINA * oaths.FURY_REFUND_PERCENT) / 100)}`,
    );
    expect(card(oaths.VITRIOL, TroopType.Knight).hero).toBe(`${deepLoss} → ${oaths.VITRIOL_LOSS_PER_TICK}`);
    expect(card(oaths.ENLIGHTENMENT, TroopType.Knight).unit).toMatch(
      new RegExp(`^Stamina recovery \\(\\+${perMinute}/min → \\+[\\d.]+/min\\)$`),
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
    expect(() => oathStatBadge(17, baseOf(TroopType.Knight))).toThrow();
  });
});
