import { describe, expect, it } from "vitest";
import { TroopTier, TroopType, type Troops } from "@bibliothecadao/types";
import { fullAtTick, staminaAt, type TroopStaminaRules } from "./troop-stamina";

/** One game's rules, as its SliceRules carries them: knights hold 120 at T1 and regain 20 a tick. */
const rules = {
  stamina_initial: 35,
  stamina_knight_max: 120,
  stamina_paladin_max: 140,
  stamina_crossbowman_max: 100,
  stamina_gain_per_tick: 20,
} as unknown as TroopStaminaRules;

const knight = (amount: number, updatedTick: number, boost = { percent: 0, ticks: 0 }): Troops => ({
  category: TroopType.Knight,
  tier: TroopTier.T1,
  count: 10n,
  stamina: { amount: BigInt(amount), updated_tick: BigInt(updatedTick) },
  boosts: {
    incr_damage_dealt_percent_num: 0,
    incr_damage_dealt_end_tick: 0,
    decr_damage_gotten_percent_num: 0,
    decr_damage_gotten_end_tick: 0,
    incr_stamina_regen_percent_num: boost.percent,
    incr_stamina_regen_tick_count: boost.ticks,
    incr_explore_reward_percent_num: 0,
    incr_explore_reward_end_tick: 0,
  },
  battle_cooldown_end: 0,
});

describe("stamina under one game's rules", () => {
  it("regains every elapsed tick up to the maximum, with boosts in integer math, and starts fresh troops as the contract does", () => {
    expect(staminaAt(knight(10, 100), 105, rules)).toEqual({ amount: 110n, updated_tick: 105n });
    expect(staminaAt(knight(10, 100), 106, rules).amount).toBe(120n);
    expect(staminaAt(knight(10, 1), 5, { ...rules, stamina_gain_per_tick: 7 }).amount).toBe(38n);
    expect(
      staminaAt(knight(10, 1, { percent: 5_000, ticks: 4 }), 5, { ...rules, stamina_gain_per_tick: 7 }).amount,
    ).toBe(BigInt(10 + 4 * 7 + 4 * 3));
    expect(staminaAt(knight(0, 0), 4, rules)).toEqual({ amount: 35n, updated_tick: 4n });
  });

  it("uses the resolved Logistics cap without adding the troop-tier bonus", () => {
    const troops = { ...knight(150, 10), tier: TroopTier.T3, staminaMax: 180 };
    expect(staminaAt(troops, 11, rules).amount).toBe(170n);
    expect(staminaAt(troops, 12, rules).amount).toBe(180n);
    expect(fullAtTick(troops, 10, rules)).toBe(12);
  });

  it("finds the first tick an army is full", () => {
    expect(fullAtTick(knight(10, 100), 100, rules)).toBe(106);
    expect(fullAtTick(knight(120, 100), 103, rules)).toBe(103);
    expect(fullAtTick(knight(10, 100), 100, { ...rules, stamina_gain_per_tick: 0 })).toBeNull();
  });
});
