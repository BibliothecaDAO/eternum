import { afterEach, describe, expect, it, vi } from "vitest";
import { setChainTimestampEvidenceSink } from "../utils/timestamp";
import { TroopTier, TroopType, type Troops } from "@bibliothecadao/types";
import { affordableAt, staminaClock, musterStamina, staminaAt, type TroopStaminaRules } from "./troop-stamina";

/** One game's rules, as its SliceRules carries them: knights hold 120 at T1 and regain 20 a tick. */
const rules = {
  stamina_initial: 35,
  stamina_knight_max: 120,
  stamina_paladin_max: 140,
  stamina_crossbowman_max: 100,
  stamina_gain_per_tick: 20,
} as unknown as TroopStaminaRules;

const knight = (amount: number, settledAt: number, boost = { percent: 0, seconds: 0 }): Troops => ({
  category: TroopType.Knight,
  tier: TroopTier.T1,
  count: 10n,
  stamina: { amount: BigInt(amount), updated_tick: BigInt(settledAt) },
  boosts: {
    incr_damage_dealt_percent_num: 0,
    incr_damage_dealt_end_tick: 0,
    decr_damage_gotten_percent_num: 0,
    decr_damage_gotten_end_tick: 0,
    incr_stamina_regen_percent_num: boost.percent,
    incr_stamina_regen_tick_count: boost.seconds,
    incr_explore_reward_percent_num: 0,
    incr_explore_reward_end_tick: 0,
  },
  battle_cooldown_end: 0,
});

afterEach(() => setChainTimestampEvidenceSink(null));

describe("stamina under one game's rules", () => {
  it.each([
    [30, 60, 2, 0, 1n],
    [20, 60, 3, 0, 1n],
    [1, 120, 120, 0, 1n],
    [30, 60, 4, 5_000, 3n],
  ])(
    "regains %i per %i seconds: after %i seconds with %i boost bps it pays %s",
    (gain, period, elapsed, percent, expected) => {
      const troops = knight(0, 101, { percent, seconds: 180 });
      expect(staminaAt(troops, 101 + elapsed, { ...rules, stamina_gain_per_tick: gain }, period).amount).toBe(expected);
      expect(staminaAt(troops, 102, { ...rules, stamina_gain_per_tick: gain }, period).amount).toBe(0n);
    },
  );

  const settle = (troops: Troops, now: number, gain = 7) => {
    const bar = staminaAt(troops, now, { ...rules, stamina_gain_per_tick: gain }, 60);
    return {
      ...troops,
      stamina: staminaClock.write(bar),
      boosts: { ...troops.boosts, incr_stamina_regen_tick_count: bar.boostSecondsLeft },
    };
  };

  it.each([0, 3_333, 5_000, 10_000])(
    "preserves every remainder when %i bps regeneration is settled every second or irregularly",
    (percent) => {
      for (let seconds = 1; seconds <= 137; seconds++) {
        const initial = knight(0, 101, { percent, seconds: 17 });
        let repeated = initial;
        let irregular = initial;
        for (let now = 102; now <= 101 + seconds; now++) {
          repeated = settle(repeated, now);
          if (now % 7 === 0) irregular = settle(irregular, now);
        }
        const once = settle(initial, 101 + seconds);
        expect(repeated).toEqual(once);
        expect(settle(irregular, 101 + seconds)).toEqual(once);
      }
    },
  );

  it("preserves the remainder across a boost starting and ending inside the span", () => {
    const initial = knight(0, 101);
    const apply = (troops: Troops) => ({
      ...troops,
      boosts: { ...troops.boosts, incr_stamina_regen_percent_num: 3_333, incr_stamina_regen_tick_count: 9 },
    });
    const once = settle(apply(settle(initial, 106)), 130);
    let repeated = initial;
    for (let now = 102; now <= 130; now++) {
      repeated = settle(repeated, now);
      if (now === 106) repeated = apply(repeated);
    }
    expect(repeated).toEqual(once);
    expect(staminaClock.read(once.stamina)).toEqual({ amount: 3n, settledAt: 130, remainder: 439_979n });
  });

  it("drops remainder at the cap, expires unused boosts, and keeps the present as the full bar's clock", () => {
    const full = settle(knight(120, 101, { percent: 5_000, seconds: 3 }), 110);
    expect(staminaClock.read(full.stamina)).toEqual({ amount: 120n, settledAt: 110, remainder: 0n });
    expect(full.boosts.incr_stamina_regen_tick_count).toBe(0);
    const spent = { ...full, stamina: { ...full.stamina, amount: 0n } };
    expect(settle(spent, 111).stamina.amount).toBe(0n);
  });

  it("initializes an untouched bar and respects the resolved Logistics cap", () => {
    expect(staminaAt(knight(0, 0), 104, rules, 60)).toMatchObject({ amount: 35n, settledAt: 104, remainder: 0n });
    const troops = { ...knight(150, 101), tier: TroopTier.T3, staminaMax: 180 };
    expect(staminaAt(troops, 161, rules, 60).amount).toBe(170n);
    expect(staminaAt(troops, 191, rules, 60).amount).toBe(180n);
    const evidence = vi.fn();
    setChainTimestampEvidenceSink(evidence);
    staminaAt(
      { ...troops, stamina: staminaClock.write({ amount: 1n, settledAt: 101, remainder: 599_999n }) },
      100,
      rules,
      60,
    );
    expect(evidence).toHaveBeenCalledWith(101);
  });

  it("musters every tier full at its trained Logistics, or inherits the previous occupant's regenerating bar", () => {
    for (const tier of [TroopTier.T1, TroopTier.T2, TroopTier.T3]) {
      const troop = { category: TroopType.Knight, tier };
      expect(musterStamina({ slot: 0, inherited: null }, troop, 101, rules, 0, 60)).toEqual({ amount: 120, max: 120 });
      expect(musterStamina({ slot: 0, inherited: null }, troop, 101, rules, 2, 60)).toEqual({ amount: 170, max: 170 });
      expect(musterStamina({ slot: 0, inherited: knight(180, 101).stamina }, troop, 102, rules, 0, 60)).toEqual({
        amount: 120,
        max: 120,
      });
      expect(musterStamina({ slot: 0, inherited: knight(7, 101).stamina }, troop, 104, rules, 0, 60)).toEqual({
        amount: 8,
        max: 120,
      });
    }
  });

  it("finds the exact second a cost is affordable across boost expiry, and refuses unreachable costs", () => {
    const troops = knight(10, 101, { percent: 5_000, seconds: 3 });
    expect(affordableAt(troops, 101, rules, 60, 12)).toBe(106);
    expect(affordableAt(troops, 101, rules, 60, 121)).toBeNull();
    expect(affordableAt(troops, 101, { ...rules, stamina_gain_per_tick: 0 }, 60, 11)).toBeNull();
  });
});

import { openArmySlots } from "./troop-stamina";
import type { NativeFactStore } from "../client/native-fact-store";
it("inherits a vacant u64 army slot without rounding the home id or treating bigint zero as occupied", () => {
  const id = (1n << 56n) + 19n;
  const stamina = { amount: 7n, updated_tick: 10n };
  const keys: unknown[] = [];
  const store = {
    subscriptionScope: () => ({ known: { expedition: { day: 2 } } }),
    requireOrAbsent: (_model: string, key: unknown) => {
      keys.push(key);
      return { known: { explorer_id: 0n, stamina } };
    },
  } as unknown as NativeFactStore;
  expect(openArmySlots(store, { game_id: 1, entity_id: id, allowedSlots: 1 })).toEqual([
    { slot: 0, inherited: stamina },
  ]);
  expect(keys).toEqual([{ game_id: 1, structure_id: id, epoch: 2n, slot: 0 }]);
});
