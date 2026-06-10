// @vitest-environment node
import { TroopTier, TroopType, type ID, type Troops } from "@bibliothecadao/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getStaminaMock, getMaxStaminaMock } = vi.hoisted(() => ({
  getStaminaMock: vi.fn((troops: Troops) => ({
    amount: troops.stamina.amount,
    updated_tick: troops.stamina.updated_tick,
  })),
  getMaxStaminaMock: vi.fn(() => 120),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  StaminaManager: {
    getStamina: getStaminaMock,
    getMaxStamina: getMaxStaminaMock,
  },
}));

import {
  buildPendingMovementStaminaSource,
  calculateMovementStaminaCost,
  resolveMovementStamina,
} from "./movement-affordability";
import { useArmyStaminaSourceStore } from "./source-store";

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

const fallbackArmy = {
  category: TroopType.Crossbowman,
  tier: TroopTier.T1,
  troopCount: 1500,
  currentStamina: 20,
  onChainStamina: { amount: 20n, updatedTick: 90 },
};

describe("movement stamina affordability", () => {
  beforeEach(() => {
    useArmyStaminaSourceStore.setState({ pendingSources: {}, authoritativeSources: {} });
  });

  it("allows movement when live stamina is sufficient even if cached army stamina is stale low", () => {
    const result = resolveMovementStamina({
      entityId: 123 as ID,
      currentArmiesTick: 100,
      actionPath: [{ staminaCost: 35 }],
      liveTroops: buildTroops({ amount: 45n, updatedTick: 100n }),
      fallbackArmy,
    });

    expect(result.canAfford).toBe(true);
    expect(result.currentStamina).toBe(45);
    expect(result.source).toBe("live");
  });

  it("uses the same resolved stamina and cost when building the pending source", () => {
    const result = resolveMovementStamina({
      entityId: 456 as ID,
      currentArmiesTick: 101,
      actionPath: [{ staminaCost: 30 }, { staminaCost: 15 }],
      pendingStamina: { amount: 70n, updatedTick: 101 },
      liveTroops: buildTroops({ amount: 100n, updatedTick: 100n }),
      fallbackArmy,
    });

    const pending = buildPendingMovementStaminaSource({
      entityId: 456 as ID,
      currentArmiesTick: result.currentArmiesTick,
      currentStamina: result.currentStamina,
      staminaCost: result.staminaCost,
      capturedAtMs: 1_000,
    });

    expect(result.source).toBe("pending");
    expect(result.staminaCost).toBe(45);
    expect(pending).toMatchObject({
      source: "pending",
      amount: 25n,
      updatedTick: 101,
      capturedAtMs: 1_000,
    });
  });

  it("keeps same-tick pending stamina when live has not matched the optimistic amount", () => {
    const result = resolveMovementStamina({
      entityId: 789 as ID,
      currentArmiesTick: 102,
      actionPath: [{ staminaCost: 50 }],
      pendingStamina: { amount: 40n, updatedTick: 102 },
      liveTroops: buildTroops({ amount: 80n, updatedTick: 102n }),
      fallbackArmy,
    });

    expect(result.canAfford).toBe(false);
    expect(result.currentStamina).toBe(40);
    expect(result.source).toBe("pending");
  });

  it("lets live stamina outrank pending once live has caught up to the pending amount", () => {
    const result = resolveMovementStamina({
      entityId: 987 as ID,
      currentArmiesTick: 103,
      actionPath: [{ staminaCost: 35 }],
      pendingStamina: { amount: 40n, updatedTick: 103 },
      liveTroops: buildTroops({ amount: 40n, updatedTick: 103n }),
      fallbackArmy,
    });

    expect(result.canAfford).toBe(true);
    expect(result.currentStamina).toBe(40);
    expect(result.source).toBe("live");
  });

  it("sums only finite movement stamina costs", () => {
    expect(calculateMovementStaminaCost([{ staminaCost: 4.7 }, { staminaCost: undefined }, { staminaCost: 5.2 }])).toBe(
      9.9,
    );
  });
});
