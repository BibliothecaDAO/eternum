// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { getNextTickStaminaMock, getTickMock } = vi.hoisted(() => ({
  getNextTickStaminaMock: vi.fn((_troops: unknown, nextTick: number) => ({
    amount: BigInt(nextTick === 6 ? 100 : 80),
    updated_tick: BigInt(nextTick),
  })),
  getTickMock: vi.fn(() => 10),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  configManager: {
    getTick: getTickMock,
  },
  StaminaManager: {
    getStamina: getNextTickStaminaMock,
  },
}));

vi.mock("@bibliothecadao/types", () => ({
  TickIds: {
    Armies: "armies",
  },
}));

import { buildProjectedStaminaDisplayModel, isStaminaRecharging } from "./stamina-visuals";

describe("stamina visuals", () => {
  it("treats partially filled stamina as recharging", () => {
    expect(isStaminaRecharging(40, 100)).toBe(true);
  });

  it("treats full stamina as stable", () => {
    expect(isStaminaRecharging(100, 100)).toBe(false);
  });

  it("guards invalid inputs", () => {
    expect(isStaminaRecharging(Number.NaN, 100)).toBe(false);
    expect(isStaminaRecharging(20, 0)).toBe(false);
  });

  it("builds projected fill growth between armies ticks", () => {
    const display = buildProjectedStaminaDisplayModel({
      committedCurrent: 80,
      committedMax: 120,
      armiesTickTimeRemaining: 5,
      currentArmiesTick: 5,
      troops: {
        category: "Knight",
        tier: 1,
        count: 10n,
        stamina: {
          amount: 80n,
          updated_tick: 5n,
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
      } as never,
    });

    expect(display.isRecharging).toBe(true);
    expect(display.nextTickGain).toBe(20);
    expect(display.progressToNextTick).toBe(0.5);
    expect(display.displayCurrent).toBe(90);
    expect(display.displayRatio).toBe(0.75);
  });

  it("disables projected growth when stamina is full", () => {
    const display = buildProjectedStaminaDisplayModel({
      committedCurrent: 120,
      committedMax: 120,
      armiesTickTimeRemaining: 5,
      currentArmiesTick: 5,
      troops: null,
    });

    expect(display.isRecharging).toBe(false);
    expect(display.nextTickGain).toBe(0);
    expect(display.displayCurrent).toBe(120);
  });

  it("keeps committed and projected stamina separate", () => {
    const display = buildProjectedStaminaDisplayModel({
      committedCurrent: 80,
      committedMax: 120,
      armiesTickTimeRemaining: 7,
      currentArmiesTick: 5,
      troops: {
        category: "Knight",
        tier: 1,
        count: 10n,
        stamina: { amount: 80n, updated_tick: 5n },
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
      } as never,
    });

    expect(display.committedCurrent).toBe(80);
    expect(display.displayCurrent).toBeGreaterThan(display.committedCurrent);
    expect(display.displayRatio).toBeGreaterThan(display.committedRatio);
  });
});
