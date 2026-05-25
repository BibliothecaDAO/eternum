import { afterEach, describe, expect, it, vi } from "vitest";
import { StaminaManager } from "./stamina-manager";
import { configManager } from "./config-manager";
import { TroopTier, TroopType, type Troops } from "@bibliothecadao/types";

describe("StaminaManager", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies stamina regen boost using integer math", () => {
    vi.spyOn(configManager, "getRefillPerTick").mockReturnValue(7);
    vi.spyOn(configManager, "getTroopStaminaConfig").mockReturnValue({ staminaInitial: 0, staminaMax: 200 });

    const troops: Troops = {
      category: TroopType.Knight,
      tier: TroopTier.T1,
      count: BigInt(10),
      stamina: {
        amount: BigInt(10),
        updated_tick: BigInt(1),
      },
      boosts: {
        incr_damage_dealt_percent_num: 0,
        incr_damage_dealt_end_tick: 0,
        decr_damage_gotten_percent_num: 0,
        decr_damage_gotten_end_tick: 0,
        incr_stamina_regen_percent_num: 5_000,
        incr_stamina_regen_tick_count: 4,
        incr_explore_reward_percent_num: 0,
        incr_explore_reward_end_tick: 0,
      },
      battle_cooldown_end: 0,
    };

    const result = StaminaManager.getStamina(troops, 5);

    const expectedRegularGain = 4 * 7;
    const expectedBoostPerTick = Math.floor((7 * 5_000) / 10_000);
    const expectedBoostGain = 4 * expectedBoostPerTick;

    expect(result.amount).toBe(BigInt(10 + expectedRegularGain + expectedBoostGain));
    expect(result.updated_tick).toBe(BigInt(5));
  });

  it("does NOT cap regen to 1 tick - applies full elapsed ticks up to max", () => {
    // Regression guard for the "why is stamina stuck at 110?" question.
    // If client's currentArmiesTick has advanced many ticks past updated_tick,
    // regen must scale with the full elapsed time (capped only at maxStamina).
    vi.spyOn(configManager, "getRefillPerTick").mockReturnValue(20);
    vi.spyOn(configManager, "getTroopStaminaConfig").mockReturnValue({ staminaInitial: 0, staminaMax: 120 });

    const troops: Troops = {
      category: TroopType.Crossbowman,
      tier: TroopTier.T1,
      count: BigInt(1500),
      stamina: {
        amount: BigInt(90),
        updated_tick: BigInt(29606127),
      },
      boosts: {
        incr_damage_dealt_percent_num: 0,
        incr_damage_dealt_end_tick: 0,
        decr_damage_gotten_percent_num: 0,
        decr_damage_gotten_end_tick: 0,
        incr_stamina_regen_percent_num: 0,
        incr_stamina_regen_tick_count: 0,
        incr_explore_reward_percent_num: 0,
        incr_explore_reward_end_tick: 0,
      },
      battle_cooldown_end: 0,
    };

    // 1 tick elapsed → 90 + 20 = 110 (this is what you're seeing on screen)
    expect(StaminaManager.getStamina(troops, 29606128).amount).toBe(110n);

    // 2 ticks elapsed → 90 + 40 = 130, capped at 120
    expect(StaminaManager.getStamina(troops, 29606129).amount).toBe(120n);

    // 100 ticks elapsed → still 120 (capped at max, NOT nerfed to 1 tick)
    expect(StaminaManager.getStamina(troops, 29606227).amount).toBe(120n);

    // 9906 ticks elapsed (roughly 6.9 days of real time at 60s/tick)
    // If currentTick advanced to real wall-clock time, regen would fully fill
    expect(StaminaManager.getStamina(troops, 29616033).amount).toBe(120n);
  });

  it("matches the contract's initial stamina behavior when updated_tick is zero", () => {
    vi.spyOn(configManager, "getRefillPerTick").mockReturnValue(20);
    vi.spyOn(configManager, "getTroopStaminaConfig").mockReturnValue({ staminaInitial: 35, staminaMax: 120 });

    const troops: Troops = {
      category: TroopType.Knight,
      tier: TroopTier.T1,
      count: BigInt(10),
      stamina: {
        amount: BigInt(0),
        updated_tick: BigInt(0),
      },
      boosts: {
        incr_damage_dealt_percent_num: 0,
        incr_damage_dealt_end_tick: 0,
        decr_damage_gotten_percent_num: 0,
        decr_damage_gotten_end_tick: 0,
        incr_stamina_regen_percent_num: 5_000,
        incr_stamina_regen_tick_count: 4,
        incr_explore_reward_percent_num: 0,
        incr_explore_reward_end_tick: 0,
      },
      battle_cooldown_end: 0,
    };

    const result = StaminaManager.getStamina(troops, 4);

    expect(result.amount).toBe(35n);
    expect(result.updated_tick).toBe(4n);
  });
});
