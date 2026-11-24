import { expect, it } from "vitest";
import { nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
import { orders, RESOURCE_PRECISION } from "@bibliothecadao/types";
import release from "../../../../../../../contracts/l3/world-native/schema/release-definition.json";
import type { PickEffectBase } from "../pick-effect-format";
import { oathEffectDescription, oathName, oathStatBadge } from "./oath-details";

const SEASON_ONE_BASE: PickEffectBase = {
  attackStamina: release.definition.rules.troop_stamina_config.stamina_attack_req,
  revealStamina: release.definition.rules.troop_stamina_config.stamina_explore_stamina_cost,
  maxStamina: release.definition.rules.troop_stamina_config.stamina_knight_max,
  staminaPerSecond:
    release.definition.rules.troop_stamina_config.stamina_gain_per_tick /
    release.definition.rules.tick_config.armies_tick_in_seconds,
  deepLossPerTick: Number(release.definition.economy.deep.Some.loss_per_tick) / RESOURCE_PRECISION,
};

it("contextualizes every Oath effect against the game's live rules", () => {
  expect(oathEffectDescription(oaths.VITRIOL, SEASON_ONE_BASE)).toBe("Deep troop loss: 200 → 100 per tick (less)");
  expect(oathEffectDescription(oaths.POWER, SEASON_ONE_BASE)).toBe("Damage dealt: 100% → 120%");
  expect(oathEffectDescription(oaths.GIANTS, SEASON_ONE_BASE)).toBe("Damage taken: 100% → 85% (less)");
  expect(oathEffectDescription(oaths.PROTECTION, SEASON_ONE_BASE)).toBe(
    "Damage taken guarding a site: 100% → 75% (less)",
  );
  expect(oathEffectDescription(oaths.REFLECTION, SEASON_ONE_BASE)).toBe("Well stamina refill: 40% → 80%");
  expect(oathEffectDescription(oaths.DETECTION, SEASON_ONE_BASE)).toBe("Guaranteed find after 4 empty reveals");
  expect(oathEffectDescription(oaths.BRILLIANCE, SEASON_ONE_BASE)).toBe("Explore rewards: 100% → 125%");
  expect(oathEffectDescription(oaths.RAGE, SEASON_ONE_BASE)).toBe("Site and guard rewards: 100% → 125%");
  expect(oathEffectDescription(oaths.ANGER, SEASON_ONE_BASE)).toBe("Attack cost: 30 → 20 stamina (less)");
  expect(oathEffectDescription(oaths.TITANS, SEASON_ONE_BASE)).toBe("+60 stamina now; max stamina: 180 → 240");
  expect(oathEffectDescription(oaths.ENLIGHTENMENT, SEASON_ONE_BASE)).toBe("Stamina recovery: +0.5/min → +0.67/min");
  expect(oathEffectDescription(oaths.FOX, SEASON_ONE_BASE)).toBe("Reveal cost: 20 → 16 stamina (Scouts 10 → 8)");
  expect(oathEffectDescription(oaths.SKILL, SEASON_ONE_BASE)).toBe(
    "Attack damage when the army has less than 10 stamina left after the attack: 100% → 130%",
  );
  expect(oathEffectDescription(oaths.FURY, SEASON_ONE_BASE)).toBe(
    "Won battle stamina refund: 0 → 15 stamina (50% of 30)",
  );
  expect(oathEffectDescription(oaths.PERFECTION, SEASON_ONE_BASE)).toBe("Clean-win (<15% lost) rewards: 100% → 150%");
  expect(oathEffectDescription(oaths.TWINS, SEASON_ONE_BASE)).toBe("Adjacent own army's damage added: 0% → 30%");
});

it("builds scannable hero stat badges for every Oath from shared rule calculations and handles missing base rules", () => {
  expect(oathStatBadge(oaths.POWER, SEASON_ONE_BASE)).toEqual({
    hero: "+20%",
    unit: "Damage dealt",
    sub: "100% → 120%",
    icon: "attack",
  });
  expect(oathStatBadge(oaths.FOX, SEASON_ONE_BASE)).toEqual({
    hero: "20 → 16",
    unit: "Reveal cost",
    sub: "Scouts 10 → 8",
    icon: "stamina",
  });
  expect(oathStatBadge(oaths.RAGE, SEASON_ONE_BASE)).toEqual({
    hero: "+25%",
    unit: "Site and guard rewards",
    sub: "100% → 125%",
    icon: "reward",
  });
  expect(oathStatBadge(oaths.VITRIOL, SEASON_ONE_BASE)).toEqual({
    hero: "200 → 100",
    unit: "Deep troop loss",
    sub: "100 per tick",
    icon: "depth-1",
  });
  expect(oathStatBadge(oaths.GIANTS, SEASON_ONE_BASE)).toEqual({
    hero: "-15%",
    unit: "Damage taken",
    sub: "100% → 85%",
    icon: "defend",
  });
  expect(oathStatBadge(oaths.PROTECTION, SEASON_ONE_BASE)).toEqual({
    hero: "-25%",
    unit: "Damage taken",
    sub: "guarding a site",
    icon: "defend",
  });
  expect(oathStatBadge(oaths.REFLECTION, SEASON_ONE_BASE)).toEqual({
    hero: "40% → 80%",
    unit: "Well stamina refill",
    sub: "+40%",
    icon: "well",
  });
  expect(oathStatBadge(oaths.DETECTION, SEASON_ONE_BASE)).toEqual({
    hero: "5th",
    unit: "4 empty reveals",
    sub: "Guaranteed find after 4 empty reveals",
    icon: "eye",
  });
  expect(oathStatBadge(oaths.BRILLIANCE, SEASON_ONE_BASE)).toEqual({
    hero: "+25%",
    unit: "Explore rewards",
    sub: "100% → 125%",
    icon: "explore",
  });
  expect(oathStatBadge(oaths.ANGER, SEASON_ONE_BASE)).toEqual({
    hero: "30 → 20",
    unit: "Attack cost",
    sub: "20 stamina",
    icon: "stamina",
  });
  expect(oathStatBadge(oaths.TITANS, SEASON_ONE_BASE)).toEqual({
    hero: "+60",
    unit: "max stamina",
    sub: "+60 stamina now · 180 → 240",
    icon: "stamina",
  });
  expect(oathStatBadge(oaths.ENLIGHTENMENT, SEASON_ONE_BASE)).toEqual({
    hero: "+0.67/min",
    unit: "Stamina recovery",
    sub: "+0.5/min → +0.67/min",
    icon: "stamina",
  });
  expect(oathStatBadge(oaths.SKILL, SEASON_ONE_BASE)).toEqual({
    hero: "+30%",
    unit: "Damage dealt",
    sub: "Attack damage when the army has less than 10 stamina left after the attack",
    icon: "attack",
  });
  expect(oathStatBadge(oaths.FURY, SEASON_ONE_BASE)).toEqual({
    hero: "+15",
    unit: "Won battle stamina refund",
    sub: "50% of 30",
    icon: "stamina",
  });
  expect(oathStatBadge(oaths.TWINS, SEASON_ONE_BASE)).toEqual({
    hero: "+30%",
    unit: "Adjacent own army's damage added",
    sub: "0% → 30%",
    icon: "people",
  });
  expect(oathStatBadge(oaths.PERFECTION, SEASON_ONE_BASE)).toEqual({
    hero: "+50%",
    unit: "Clean-win (<15% lost) rewards",
    sub: "100% → 150%",
    icon: "crown",
  });

  expect(oathStatBadge(oaths.VITRIOL, {}).hero).toBe("100");
  expect(oathStatBadge(oaths.ANGER, {}).hero).toBe("20");
  expect(oathStatBadge(oaths.FOX, {})).toEqual({
    hero: "-20%",
    unit: "Reveal cost",
    sub: "less",
    icon: "stamina",
  });
  expect(oathStatBadge(oaths.FURY, {})).toEqual({
    hero: "50%",
    unit: "Won battle stamina refund",
    sub: "0% → 50%",
    icon: "stamina",
  });
  expect(oathStatBadge(oaths.ENLIGHTENMENT, {}).hero).toBe("+33%");
});

it("follows tuned game rules and keeps badge figures aligned with effect descriptions", () => {
  const customBase: PickEffectBase = {
    ...SEASON_ONE_BASE,
    deepLossPerTick: 400,
    attackStamina: 40,
    revealStamina: 25,
    maxStamina: 200,
    staminaPerSecond: 1 / 20,
  };
  expect(oathEffectDescription(oaths.VITRIOL, customBase)).toBe("Deep troop loss: 400 → 100 per tick (less)");
  expect(oathStatBadge(oaths.VITRIOL, customBase).hero).toBe("400 → 100");
  expect(oathEffectDescription(oaths.ANGER, customBase)).toBe("Attack cost: 40 → 20 stamina (less)");
  expect(oathStatBadge(oaths.ANGER, customBase).hero).toBe("40 → 20");
  expect(oathEffectDescription(oaths.FOX, customBase)).toBe("Reveal cost: 25 → 20 stamina (Scouts 10 → 8)");
  expect(oathStatBadge(oaths.FOX, customBase).hero).toBe("25 → 20");
  expect(oathEffectDescription(oaths.FURY, customBase)).toBe("Won battle stamina refund: 0 → 20 stamina (50% of 40)");
  expect(oathStatBadge(oaths.FURY, customBase).hero).toBe("+20");
  expect(oathEffectDescription(oaths.TITANS, customBase)).toBe("+60 stamina now; max stamina: 200 → 260");
  expect(oathStatBadge(oaths.TITANS, customBase).sub).toBe("+60 stamina now · 200 → 260");
  expect(oathEffectDescription(oaths.ENLIGHTENMENT, customBase)).toBe("Stamina recovery: +3/min → +4/min");
  expect(oathStatBadge(oaths.ENLIGHTENMENT, customBase).hero).toBe("+4/min");
  expect(oathEffectDescription(oaths.VITRIOL, {})).toBe("Deep troop loss: 100 per tick");
  expect(oathEffectDescription(oaths.ANGER, {})).toBe("Attack cost: 20 stamina");
  expect(oathEffectDescription(oaths.DETECTION, {})).toBe("Guaranteed find after 4 empty reveals");
});

it("describes every playable Oath uniquely with its own rule and rejects unknown ids", () => {
  const playable = orders.filter((order) => order.orderId > 0);
  expect(playable).toHaveLength(16);
  const descriptions = playable.map((order) => {
    expect(oathName(order.orderId)).toBe(order.orderName);
    return oathEffectDescription(order.orderId, SEASON_ONE_BASE);
  });
  const badges = playable.map((order) => {
    const badge = oathStatBadge(order.orderId, SEASON_ONE_BASE);
    return `${badge.hero}|${badge.unit}|${badge.sub}`;
  });
  expect(new Set(descriptions).size).toBe(16);
  expect(new Set(badges).size).toBe(16);
  expect(() => oathName(0)).toThrow();
  expect(() => oathEffectDescription(17, SEASON_ONE_BASE)).toThrow();
  expect(() => oathStatBadge(17, SEASON_ONE_BASE)).toThrow();
});
