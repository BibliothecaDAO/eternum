import { describe, expect, it } from "vitest";
import { TroopTier, TroopType, type Troops } from "@bibliothecadao/types";
import { affordableAt, musterStamina, staminaAt, type TroopStaminaRules } from "./troop-stamina";

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
  stamina: { amount: BigInt(amount), settled_at: settledAt, remainder: 0 },
  boosts: {
    incr_damage_dealt_percent_num: 0,
    incr_damage_dealt_end_at: 0,
    decr_damage_gotten_percent_num: 0,
    decr_damage_gotten_end_at: 0,
    incr_stamina_regen_percent_num: boost.percent,
    incr_stamina_regen_seconds_left: boost.seconds,
    incr_explore_reward_percent_num: 0,
    incr_explore_reward_end_at: 0,
  },
  battle_cooldown_end: 0,
});

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
      stamina: { amount: bar.amount, settled_at: bar.settled_at, remainder: bar.remainder },
      boosts: { ...troops.boosts, incr_stamina_regen_seconds_left: bar.boostSecondsLeft },
    };
  };

  it.each([0, 3_333, 5_000, 10_000])(
    "pays the same stamina with %i bps regeneration settled once, every second, or irregularly",
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
        expect(repeated.stamina.amount).toBe(once.stamina.amount);
        expect(settle(irregular, 101 + seconds).stamina.amount).toBe(once.stamina.amount);
      }
    },
  );

  it("pays the same stamina across a boost starting and ending inside the span", () => {
    const initial = knight(0, 101);
    const apply = (troops: Troops) => ({
      ...troops,
      boosts: { ...troops.boosts, incr_stamina_regen_percent_num: 3_333, incr_stamina_regen_seconds_left: 9 },
    });
    const once = settle(apply(settle(initial, 106)), 130);
    let repeated = initial;
    for (let now = 102; now <= 130; now++) {
      repeated = settle(repeated, now);
      if (now === 106) repeated = apply(repeated);
    }
    expect(repeated.stamina.amount).toBe(once.stamina.amount);
    expect(once.stamina.amount).toBe(3n);
    expect(settle(once, 190).stamina.amount).toBe(10n);
    for (let now = 131; now <= 190; now++) {
      expect(settle(repeated, now).stamina.amount).toBe(settle(once, now).stamina.amount);
    }
  });

  it("never banks regeneration or an unused boost while the bar is full", () => {
    const full = settle(knight(120, 101, { percent: 5_000, seconds: 3 }), 110);
    expect(full.stamina.amount).toBe(120n);
    const spent = { ...full, stamina: { ...full.stamina, amount: 0n } };
    expect(settle(spent, 111).stamina.amount).toBe(0n);
    expect(settle(spent, 117).stamina.amount).toBe(0n);
    expect(settle(spent, 118).stamina.amount).toBe(0n);
    expect(settle(spent, 119).stamina.amount).toBe(1n);
  });

  it("initializes an untouched bar and respects the resolved Logistics cap", () => {
    expect(staminaAt(knight(0, 0), 104, rules, 60).amount).toBe(35n);
    const troops = { ...knight(150, 101), tier: TroopTier.T3, staminaMax: 180 };
    expect(staminaAt(troops, 161, rules, 60).amount).toBe(170n);
    expect(staminaAt(troops, 191, rules, 60).amount).toBe(180n);
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
