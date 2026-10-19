import { configManager } from "@bibliothecadao/eternum";
import { TroopTier, TroopType, type Troops } from "@bibliothecadao/types";
import { afterEach, expect, it, vi } from "vitest";
import { getGuardStaminaSnapshot } from "./guard-stamina";

afterEach(() => vi.restoreAllMocks());

it("keeps the resolved Frontier guard cap through refill and display, while legacy guards retain their tier bonus", () => {
  vi.spyOn(configManager, "getTick").mockReturnValue(60);
  vi.spyOn(configManager, "getTroopStaminaRules").mockReturnValue({
    stamina_initial: 120,
    stamina_knight_max: 120,
    stamina_gain_per_tick: 20,
  } as ReturnType<typeof configManager.getTroopStaminaRules>);
  const guard: Troops = {
    category: TroopType.Knight,
    tier: TroopTier.T3,
    count: 0n,
    stamina: { amount: 100n, settled_at: 10, remainder: 0 },
    boosts: {
      incr_damage_dealt_percent_num: 0,
      incr_damage_dealt_end_at: 0,
      decr_damage_gotten_percent_num: 0,
      decr_damage_gotten_end_at: 0,
      incr_stamina_regen_percent_num: 0,
      incr_stamina_regen_seconds_left: 0,
      incr_explore_reward_percent_num: 0,
      incr_explore_reward_end_at: 0,
    },
    battle_cooldown_end: 0,
  };
  expect(getGuardStaminaSnapshot({ ...guard, staminaMax: 120 }, 190)).toEqual({ current: 120, max: 120 });
  expect(getGuardStaminaSnapshot(guard, 190)).toEqual({ current: 160, max: 160 });
});
