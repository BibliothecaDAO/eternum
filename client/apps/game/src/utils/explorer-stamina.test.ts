// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { getStaminaMock, getMaxStaminaMock } = vi.hoisted(() => ({
  getStaminaMock: vi.fn((troops: { stamina: { amount: bigint; updated_tick: bigint } }) => ({
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

import {
  getExplorerStaminaSnapshot,
  getTroopsStaminaUpdatedTick,
  selectFreshestTroopsSnapshot,
} from "./explorer-stamina";

const buildTroops = (updatedTick: bigint, amount: bigint) => ({
  category: "Knight",
  tier: 1,
  count: 10n,
  stamina: { amount, updated_tick: updatedTick },
  boosts: {
    incr_stamina_regen_percent_num: 0,
    incr_stamina_regen_tick_count: 0,
    incr_explore_reward_percent_num: 0,
    incr_explore_reward_end_tick: 0,
    incr_damage_dealt_percent_num: 0,
    incr_damage_dealt_end_tick: 0,
    decr_damage_gotten_percent_num: 0,
    decr_damage_gotten_end_tick: 0,
  },
  battle_cooldown_end: 0,
});

describe("explorer stamina source selection", () => {
  it("reads the updated tick from live troop stamina", () => {
    expect(getTroopsStaminaUpdatedTick(buildTroops(7n, 30n) as never)).toBe(7n);
    expect(getTroopsStaminaUpdatedTick(null)).toBe(0n);
  });

  it("returns live RECS troops when no pending movement exists", () => {
    const liveTroops = buildTroops(6n, 25n);

    expect(selectFreshestTroopsSnapshot({ liveTroops: liveTroops as never })).toBe(liveTroops);
  });

  it("projects stamina from the selected live source", () => {
    const liveTroops = buildTroops(6n, 25n);
    const staminaSnapshot = getExplorerStaminaSnapshot({
      currentArmiesTick: 8,
      liveTroops: liveTroops as never,
    });

    expect(staminaSnapshot?.troops).toBe(liveTroops);
    expect(staminaSnapshot?.stamina.amount).toBe(25n);
  });
});
