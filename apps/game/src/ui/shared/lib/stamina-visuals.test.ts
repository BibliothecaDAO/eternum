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
    getFullAtTick: () => 7,
  },
}));

vi.mock("@bibliothecadao/types", () => ({
  TickIds: {
    Armies: "armies",
  },
}));

import { buildStaminaDisplayModel, describeNextStaminaGain, isStaminaRecharging } from "./stamina-visuals";

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

  const knights = {
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
  } as never;

  it("shows only the stamina the chain holds mid-tick, and names the next gain and when it lands", () => {
    const display = buildStaminaDisplayModel({
      committedCurrent: 80,
      committedMax: 120,
      armiesTickTimeRemaining: 72,
      currentArmiesTick: 5,
      troops: knights,
    });

    expect(display).toMatchObject({ committedCurrent: 80, committedRatio: 80 / 120, isRecharging: true });
    expect(display).not.toHaveProperty("displayCurrent");
    expect(display.nextTickGain).toBe(20);
    expect(display.secondsUntilFull).toBe(72 + 10);
    expect(describeNextStaminaGain(display)).toBe("+20 in 1:12");
  });

  it("names no next gain when stamina is full", () => {
    const display = buildStaminaDisplayModel({
      committedCurrent: 120,
      committedMax: 120,
      armiesTickTimeRemaining: 5,
      currentArmiesTick: 5,
      troops: null,
    });

    expect(display.isRecharging).toBe(false);
    expect(describeNextStaminaGain(display)).toBeNull();
  });
});
