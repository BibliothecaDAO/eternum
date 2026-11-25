import { describe, expect, it } from "vitest";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { oathBit } from "@bibliothecadao/eternum";
import { nativeOathConstants as oaths, nativeRuleConstants } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, TroopType } from "@bibliothecadao/types";
import { PICK_EFFECT_WORDS, RESEARCH_TREE } from "@/ui/design-system/kit/words";
import release from "../../../../../../contracts/l3/world-native/schema/release-definition.json";

import {
  damageDealtEffect,
  damageTakenEffect,
  fromToEffect,
  percentFromTo,
  staminaRecoveryEffect,
} from "./pick-effect-format";
import { readPickEffectBase } from "./pick-effect-text";

describe("shared pick-effect text builder", () => {
  it("formats contextual from-to and shared stat lines", () => {
    expect(fromToEffect("Deep troop loss", "200", "100 per tick", "less")).toBe(
      "Deep troop loss: 200 → 100 per tick (less)",
    );
    expect(RESEARCH_TREE.less).toBe(`(${PICK_EFFECT_WORDS.less})`);
    expect(percentFromTo("Damage taken", 100, 85, "less")).toBe("Damage taken: 100% → 85% (less)");
    expect(damageDealtEffect(20)).toBe("Damage dealt: 100% → 120%");
    expect(damageTakenEffect(15)).toBe("Damage taken: 100% → 85% (less)");
    expect(damageTakenEffect(25, "guarding a site")).toBe("Damage taken guarding a site: 100% → 75% (less)");
    expect(staminaRecoveryEffect(1 / 120, 13_334)).toBe("Stamina recovery: +0.5/min → +0.67/min");
    expect(staminaRecoveryEffect(undefined, 16_000)).toBe("Stamina recovery: 100% → 160%");
  });

  it("reads live SliceRules and DeepRules without silent defaults when absent", () => {
    const store = new NativeFactStore();
    expect(readPickEffectBase(store, 1)).toEqual({
      category: TroopType.Knight,
      tickSeconds: undefined,
      attackStamina: undefined,
      revealStamina: undefined,
      maxStamina: undefined,
      staminaPerSecond: undefined,
      deepLossPerTick: undefined,
    });
    store.applyFacts([
      {
        model: "SliceRules",
        key: "0x1",
        value: {
          ...release.definition.rules,
          game_id: 1,
          tick_config: { ...release.definition.rules.tick_config, armies_tick_in_seconds: 60 },
          troop_stamina_config: {
            ...release.definition.rules.troop_stamina_config,
            stamina_attack_req: 40,
            stamina_explore_stamina_cost: 25,
            stamina_knight_max: 200,
            stamina_gain_per_tick: 1,
          },
        },
      },
      {
        model: "DeepRules",
        key: "0x2",
        value: {
          ...release.definition.economy.deep.Some,
          game_id: 1,
          loss_per_tick: String(350n * BigInt(RESOURCE_PRECISION)),
        },
      },
    ] as never);
    expect(readPickEffectBase(store, 1)).toEqual({
      category: TroopType.Knight,
      tickSeconds: 60,
      attackStamina: 40,
      revealStamina: 25,
      maxStamina: 200,
      staminaPerSecond: 1 / 60,
      deepLossPerTick: 350,
    });
    const scouts = { category: TroopType.Paladin, logistics: 0, oaths: 0 };
    expect(readPickEffectBase(store, 1, scouts).revealStamina).toBe(nativeRuleConstants.SCOUT_EXPLORE_STAMINA);
    const sworn = (oath: number) => readPickEffectBase(store, 1, { ...scouts, oaths: oathBit(oath) });
    expect(sworn(oaths.FOX).revealStamina).toBe(
      Math.floor((nativeRuleConstants.SCOUT_EXPLORE_STAMINA * (100 - oaths.FOX_REVEAL_DISCOUNT_PERCENT)) / 100),
    );
    expect(sworn(oaths.ANGER).attackStamina).toBe(oaths.ANGER_ATTACK_STAMINA);
    expect(sworn(oaths.VITRIOL).deepLossPerTick).toBe(oaths.VITRIOL_LOSS_PER_TICK);
    expect(sworn(oaths.TITANS).maxStamina! - readPickEffectBase(store, 1, scouts).maxStamina!).toBe(
      oaths.TITANS_STAMINA,
    );
    expect(readPickEffectBase(store, 1, { ...scouts, logistics: 2 }).maxStamina).toBeGreaterThan(
      readPickEffectBase(store, 1, scouts).maxStamina!,
    );
  });
});
