import { configManager, StaminaManager } from "@bibliothecadao/eternum";
import { TroopTier, TroopType, type Troops } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildStaminaDisplayModel } from "./presentation";

/** Frontier's stamina: a 150 bar regaining one point every 120 seconds. */
const TICK_SECONDS = 120;
const rules = {
  stamina_initial: 150,
  stamina_knight_max: 150,
  stamina_paladin_max: 150,
  stamina_crossbowman_max: 150,
  stamina_gain_per_tick: 1,
};

const knights = (amount: number, updatedTick: number): Troops => ({
  category: TroopType.Knight,
  tier: TroopTier.T1,
  count: 1_500_000_000_000n,
  stamina: { amount: BigInt(amount), updated_tick: BigInt(updatedTick) },
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
});

/** The model as the HUD builds it each second from chain time. */
const displayAt = (troops: Troops, nowSeconds: number) => {
  const currentArmiesTick = Math.floor(nowSeconds / TICK_SECONDS);
  return buildStaminaDisplayModel({
    committedCurrent: Number(StaminaManager.getStamina(troops, currentArmiesTick).amount),
    committedMax: 150,
    armiesTickTimeRemaining: (currentArmiesTick + 1) * TICK_SECONDS - nowSeconds,
    currentArmiesTick,
    troops,
  });
};

describe("time until an army is full", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lands on the contract's full tick every second for ten minutes", () => {
    vi.spyOn(configManager, "getTroopStaminaRules").mockReturnValue(rules as never);
    vi.spyOn(configManager, "getTick").mockReturnValue(TICK_SECONDS);
    const updatedTick = 1_000;
    const troops = knights(90, updatedTick);
    // The contract refills one point per elapsed tick, so the bar is full at tick updated + (150 - 90).
    const contractFullAt = (updatedTick + 60) * TICK_SECONDS;
    const start = updatedTick * TICK_SECONDS + 37;

    for (let now = start; now <= start + 600; now += 1) {
      expect(now + displayAt(troops, now).secondsUntilFull).toBe(contractFullAt);
    }
  });

  it("is zero once the bar is full", () => {
    vi.spyOn(configManager, "getTroopStaminaRules").mockReturnValue(rules as never);
    vi.spyOn(configManager, "getTick").mockReturnValue(TICK_SECONDS);
    expect(displayAt(knights(150, 10), 10 * TICK_SECONDS + 5).secondsUntilFull).toBe(0);
  });
});
