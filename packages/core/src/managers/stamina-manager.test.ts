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

    const expectedRegularGain = 4 * 7;
    const expectedBoostPerTick = Math.floor((7 * 5_000) / 10_000);
    const expectedBoostGain = 4 * expectedBoostPerTick;

    expect(result.amount).toBe(BigInt(10 + expectedRegularGain + expectedBoostGain));
    expect(result.updated_tick).toBe(BigInt(4));
  });
});
