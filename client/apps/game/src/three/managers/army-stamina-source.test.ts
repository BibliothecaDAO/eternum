import { describe, expect, it, vi, afterEach } from "vitest";

import { TroopTier, TroopType, type Troops } from "@bibliothecadao/types";

import { resolveAuthoritativeArmyStamina } from "./army-stamina-source";

const { getStaminaMock } = vi.hoisted(() => ({
  getStaminaMock: vi.fn(),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  StaminaManager: {
    getStamina: getStaminaMock,
  },
}));

describe("resolveAuthoritativeArmyStamina", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getStaminaMock.mockReset();
  });

  const makeTroops = (staminaAmount: bigint, updatedTick: bigint): Troops => ({
    category: TroopType.Knight,
    tier: TroopTier.T1,
    count: 100n,
    stamina: {
      amount: staminaAmount,
      updated_tick: updatedTick,
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
  });

  it("prefers live ExplorerTroops stamina when it is newer than fallback", () => {
    getStaminaMock.mockReturnValue({ amount: 10n, updated_tick: 20n });

    const resolved = resolveAuthoritativeArmyStamina({
      currentArmiesTick: 20,
      fallbackCurrentStamina: 40,
      fallbackOnChainStamina: { amount: 10n, updatedTick: 5 },
      liveTroops: makeTroops(10n, 20n),
    });

    expect(resolved.currentStamina).toBe(10);
    expect(resolved.onChainStamina).toEqual({ amount: 10n, updatedTick: 20 });
  });

  it("keeps fallback stamina when live ExplorerTroops stamina is older", () => {
    const resolved = resolveAuthoritativeArmyStamina({
      currentArmiesTick: 20,
      fallbackCurrentStamina: 42,
      fallbackOnChainStamina: { amount: 42n, updatedTick: 18 },
      liveTroops: makeTroops(10n, 12n),
    });

    expect(resolved.currentStamina).toBe(42);
    expect(resolved.onChainStamina).toEqual({ amount: 42n, updatedTick: 18 });
  });

  it("keeps fallback stamina when live ExplorerTroops data is missing", () => {
    const resolved = resolveAuthoritativeArmyStamina({
      currentArmiesTick: 20,
      fallbackCurrentStamina: 37,
      fallbackOnChainStamina: { amount: 37n, updatedTick: 18 },
      liveTroops: undefined,
    });

    expect(resolved.currentStamina).toBe(37);
    expect(resolved.onChainStamina).toEqual({ amount: 37n, updatedTick: 18 });
  });
});
