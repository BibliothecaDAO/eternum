import { expect, it } from "vitest";
import { nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
import { orders, RESOURCE_PRECISION } from "@bibliothecadao/types";
import release from "../../../../../../../contracts/l3/world-native/schema/release-definition.json";
import type { PickEffectBase } from "../pick-effect-text";
import { oathEffectDescription, oathName } from "./oath-details";

const SEASON_ONE_BASE: PickEffectBase = {
  attackStamina: release.definition.rules.troop_stamina_config.stamina_attack_req,
  revealStamina: release.definition.rules.troop_stamina_config.stamina_explore_stamina_cost,
  maxStamina: release.definition.rules.troop_stamina_config.stamina_knight_max,
  staminaPerSecond:
    release.definition.rules.troop_stamina_config.stamina_gain_per_tick /
    release.definition.rules.tick_config.armies_tick_in_seconds,
  deepLossPerTick: Number(release.definition.economy.deep.Some.loss_per_tick) / RESOURCE_PRECISION,
  emptyRevealLimit: release.definition.economy.discovery.Some.empty_reveal_limit,
};

it("contextualizes every Oath effect against the game's live rules", () => {
  expect(oathEffectDescription(oaths.VITRIOL, SEASON_ONE_BASE)).toBe("Deep troop loss: 200 → 100 per tick (less)");
  expect(oathEffectDescription(oaths.POWER, SEASON_ONE_BASE)).toBe("Damage dealt: 100% → 120%");
  expect(oathEffectDescription(oaths.GIANTS, SEASON_ONE_BASE)).toBe("Damage taken: 100% → 85% (less)");
  expect(oathEffectDescription(oaths.PROTECTION, SEASON_ONE_BASE)).toBe(
    "Damage taken guarding a site: 100% → 75% (less)",
  );
  expect(oathEffectDescription(oaths.REFLECTION, SEASON_ONE_BASE)).toBe("Well stamina refill: 40% → 80%");
  expect(oathEffectDescription(oaths.DETECTION, SEASON_ONE_BASE)).toBe(
    "Guaranteed find after 4 empty reveals instead of 7",
  );
  expect(oathEffectDescription(oaths.BRILLIANCE, SEASON_ONE_BASE)).toBe("Explore rewards: 100% → 125%");
  expect(oathEffectDescription(oaths.RAGE, SEASON_ONE_BASE)).toBe("Site and guard rewards: 100% → 125%");
  expect(oathEffectDescription(oaths.ANGER, SEASON_ONE_BASE)).toBe("Attack cost: 30 → 20 stamina (less)");
  expect(oathEffectDescription(oaths.TITANS, SEASON_ONE_BASE)).toBe("+60 stamina now; max stamina: 180 → 240");
  expect(oathEffectDescription(oaths.ENLIGHTENMENT, SEASON_ONE_BASE)).toBe("Stamina recovery: +0.5/min → +0.67/min");
  expect(oathEffectDescription(oaths.FOX, SEASON_ONE_BASE)).toBe("Reveal cost: 20 → 16 stamina (Scouts 10 → 8)");
  expect(oathEffectDescription(oaths.SKILL, SEASON_ONE_BASE)).toBe("Low-stamina (<10) attack damage: 100% → 130%");
  expect(oathEffectDescription(oaths.FURY, SEASON_ONE_BASE)).toBe(
    "Won battle stamina refund: 0 → 15 stamina (50% of 30)",
  );
  expect(oathEffectDescription(oaths.PERFECTION, SEASON_ONE_BASE)).toBe("Clean-win (<15% lost) rewards: 100% → 150%");
  expect(oathEffectDescription(oaths.TWINS, SEASON_ONE_BASE)).toBe("Nearby ally bonus damage: 0% → 30%");
});

it("follows tuned game rules and avoids invented base figures when a rule row is absent", () => {
  const customBase: PickEffectBase = {
    ...SEASON_ONE_BASE,
    deepLossPerTick: 400,
    attackStamina: 40,
    staminaPerSecond: 1 / 20,
  };
  expect(oathEffectDescription(oaths.VITRIOL, customBase)).toBe("Deep troop loss: 400 → 100 per tick (less)");
  expect(oathEffectDescription(oaths.ANGER, customBase)).toBe("Attack cost: 40 → 20 stamina (less)");
  expect(oathEffectDescription(oaths.ENLIGHTENMENT, customBase)).toBe("Stamina recovery: +3/min → +4/min");
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
  expect(new Set(descriptions).size).toBe(16);
  expect(() => oathName(0)).toThrow();
  expect(() => oathEffectDescription(17, SEASON_ONE_BASE)).toThrow();
});
