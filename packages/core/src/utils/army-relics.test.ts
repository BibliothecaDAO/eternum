import { describe, expect, it } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";
import { armyRelicsEnabled, staminaRegenBoost } from "./army-relics";
import release from "../../../../contracts/l3/world-native/schema/release-definition.json";

const sliceRules = (day_unit_seconds: number) => ({
  model: "SliceRules" as const,
  key: "0x1",
  value: { ...release.definition.rules, game_id: 1, day_unit_seconds },
});

const storeWith = (facts: readonly object[]) => {
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
  store.applyFacts(facts as never);
  return store;
};

describe("armyRelicsEnabled", () => {
  it("is true for a day game", () => {
    expect(armyRelicsEnabled(storeWith([sliceRules(3600)]), 1)).toBe(true);
  });

  it("is false for a game without days", () => {
    expect(armyRelicsEnabled(storeWith([sliceRules(0)]), 1)).toBe(false);
  });

  it("cannot tell while the game's rules are not held", () => {
    expect(armyRelicsEnabled(storeWith([]), 1)).toBeUndefined();
  });
});

describe("the stamina relic's regeneration boost", () => {
  const army = { game_id: 1, explorer_id: 7n };
  const none = { incr_stamina_regen_percent_num: 0, incr_stamina_regen_seconds_left: 0 };
  const facts = (dayUnit: number, effect: { known: unknown } | { unknown: string }) =>
    ({
      get: (model: string) => (model === "SliceRules" ? { day_unit_seconds: dayUnit } : undefined),
      subscriptionScope: () => ({ known: {} }),
      requireOrAbsent: () => effect,
    }) as never;
  const running = (rank: number, expires_at: bigint) => facts(43_200, { known: { rank, expires_at } });

  it("raises regeneration by the step a level for the seconds the relic still runs", () => {
    expect(staminaRegenBoost(running(3, 1_000n), army, 400)).toEqual({
      incr_stamina_regen_percent_num: 3 * nativeRuleConstants.STAMINA_REGEN_RELIC_STEP_PERCENT * 100,
      incr_stamina_regen_seconds_left: 600,
    });
  });

  it("adds nothing once the relic has run out, without one, or in a game without army relics", () => {
    expect(staminaRegenBoost(running(3, 1_000n), army, 1_000)).toEqual(none);
    expect(staminaRegenBoost(running(0, 0n), army, 400)).toEqual(none);
    expect(staminaRegenBoost(facts(0, { unknown: "unread" }), army, 400)).toEqual(none);
  });

  it("is not known until the army's relic effect is", () => {
    expect(staminaRegenBoost(facts(43_200, { unknown: "INCOMPLETE_SNAPSHOT" }), army, 400)).toBeUndefined();
  });
});
