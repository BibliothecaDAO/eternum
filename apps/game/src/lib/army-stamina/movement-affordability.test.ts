// @vitest-environment node
import { TroopTier, TroopType, type ID, type Troops } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";

const { getStaminaMock, getMaxStaminaMock } = vi.hoisted(() => ({
  getStaminaMock: vi.fn((troops: Troops) => ({
    amount: troops.stamina.amount,
    updated_tick: troops.stamina.updated_tick,
  })),
  getMaxStaminaMock: vi.fn(() => 120),
}));

vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  StaminaManager: {
    getStamina: getStaminaMock,
    getMaxStamina: getMaxStaminaMock,
  },
}));

import { calculateMovementStaminaCost, resolveMovementStamina } from "./movement-affordability";

const buildTroops = (overrides: { amount: bigint; updatedTick: bigint }): Troops => ({
  category: TroopType.Crossbowman,
  tier: TroopTier.T1,
  count: 1500n,
  stamina: {
    amount: overrides.amount,
    updated_tick: overrides.updatedTick,
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

describe("movement stamina affordability", () => {
  it("allows movement when live RECS stamina is sufficient", () => {
    const result = resolveMovementStamina({
      entityId: 123 as ID,
      currentArmiesTick: 100,
      actionPath: [{ staminaCost: 35 }],
      liveTroops: buildTroops({ amount: 45n, updatedTick: 100n }),
    });

    expect(result.canAfford).toBe(true);
    expect(result.currentStamina).toBe(45);
    expect(result.source).toBe("live");
  });

  it("rejects movement when live RECS stamina is insufficient", () => {
    const result = resolveMovementStamina({
      entityId: 456 as ID,
      currentArmiesTick: 101,
      actionPath: [{ staminaCost: 30 }, { staminaCost: 15 }],
      liveTroops: buildTroops({ amount: 40n, updatedTick: 101n }),
    });

    expect(result.source).toBe("live");
    expect(result.staminaCost).toBe(45);
    expect(result.canAfford).toBe(false);
    expect(result.currentStamina).toBe(40);
  });

  it("sums only finite movement stamina costs", () => {
    expect(calculateMovementStaminaCost([{ staminaCost: 4.7 }, { staminaCost: undefined }, { staminaCost: 5.2 }])).toBe(
      9.9,
    );
  });
});
