// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { getStaminaMock, getMaxStaminaMock } = vi.hoisted(() => ({
  getStaminaMock: vi.fn((troops: { stamina: { amount: bigint; updated_tick: bigint } }) => ({
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

import { useArmyStaminaSourceStore } from "@/lib/army-stamina/source-store";
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

describe("explorer stamina source selection", () => {
  it("reads the updated tick from troop stamina snapshots", () => {
    expect(getTroopsStaminaUpdatedTick(buildTroops(7n, 30n) as never)).toBe(7n);
    expect(getTroopsStaminaUpdatedTick(null)).toBe(0n);
  });

  it("prefers the newer snapshot over a stale live troop snapshot", () => {
    const liveTroops = buildTroops(4n, 10n);
    const snapshotTroops = buildTroops(6n, 25n);

    expect(
      selectFreshestTroopsSnapshot({
        liveTroops: liveTroops as never,
        snapshotTroops: snapshotTroops as never,
      }),
    ).toBe(snapshotTroops);
  });

  it("prefers the authoritative snapshot when both snapshots are equally fresh", () => {
    const liveTroops = buildTroops(6n, 10n);
    const snapshotTroops = buildTroops(6n, 25n);

    expect(
      selectFreshestTroopsSnapshot({
        liveTroops: liveTroops as never,
        snapshotTroops: snapshotTroops as never,
      }),
    ).toBe(snapshotTroops);
  });

  it("prefers the authoritative snapshot when stamina amount differs at the same tick", () => {
    const liveTroops = buildTroops(6n, 80n);
    const snapshotTroops = buildTroops(6n, 50n);

    expect(
      selectFreshestTroopsSnapshot({
        liveTroops: liveTroops as never,
        snapshotTroops: snapshotTroops as never,
      }),
    ).toBe(snapshotTroops);
  });

  it("falls back to synthesized troops when no troop snapshot is available", () => {
    expect(
      selectFreshestTroopsSnapshot({
        fallbackArmy: {
          category: "Knight" as never,
          tier: 1 as never,
          troopCount: 10,
          onChainStamina: {
            amount: 33n,
            updatedTick: 9,
          },
        },
      }),
    ).toMatchObject({
      count: 10n,
      stamina: {
        amount: 33n,
        updated_tick: 9n,
      },
    });
  });

  it("prefers a pending local stamina overlay when it is strictly newer than remote snapshots", () => {
    const liveTroops = buildTroops(6n, 80n);
    const snapshotTroops = buildTroops(6n, 50n);

    expect(
      selectFreshestTroopsSnapshot({
        liveTroops: liveTroops as never,
        snapshotTroops: snapshotTroops as never,
        pendingStamina: {
          amount: 20n,
          updatedTick: 7,
        },
      }),
    ).toMatchObject({
      stamina: {
        amount: 20n,
        updated_tick: 7n,
      },
    });
  });

  it("discards a pending overlay once onchain snapshots have caught up to its tick and amount", () => {
    const liveTroops = buildTroops(6n, 80n);
    const snapshotTroops = buildTroops(6n, 20n);

    expect(
      selectFreshestTroopsSnapshot({
        liveTroops: liveTroops as never,
        snapshotTroops: snapshotTroops as never,
        pendingStamina: {
          amount: 20n,
          updatedTick: 6,
        },
      }),
    ).toBe(snapshotTroops);
  });

  it("projects stamina from the freshest selected source", () => {
    const liveTroops = buildTroops(4n, 10n);
    const snapshotTroops = buildTroops(6n, 25n);

    const staminaSnapshot = getExplorerStaminaSnapshot({
      currentArmiesTick: 8,
      liveTroops: liveTroops as never,
      snapshotTroops: snapshotTroops as never,
    });

    expect(staminaSnapshot?.troops).toBe(snapshotTroops);
    expect(staminaSnapshot?.stamina.amount).toBe(25n);
  });

  it("consults the authoritative snapshot store when entityId is provided", () => {
    const entityId = 42;
    const boostedTroops = {
      ...buildTroops(5n, 10n),
      boosts: {
        ...buildTroops(5n, 10n).boosts,
        incr_stamina_regen_percent_num: 5000,
        incr_stamina_regen_tick_count: 4,
      },
    };

    // Seed the authoritative store (normally populated by the UI panel)
    useArmyStaminaSourceStore.setState({
      authoritativeSources: {
        [String(entityId)]: {
          source: "snapshot",
          entityId,
          amount: 10n,
          updatedTick: 5,
          troopCount: 10,
          capturedAtMs: Date.now(),
          troops: boostedTroops as never,
        },
      },
    });

    // Without entityId: falls back to fallback with zeroed boosts
    const withoutId = selectFreshestTroopsSnapshot({
      fallbackArmy: {
        category: "Knight" as never,
        tier: 1 as never,
        troopCount: 10,
        onChainStamina: { amount: 10n, updatedTick: 5 },
      },
    });
    expect(withoutId?.boosts?.incr_stamina_regen_percent_num).toBe(0);

    // With entityId: authoritative snapshot (with boosts) is preferred
    const withId = selectFreshestTroopsSnapshot({
      entityId: entityId as never,
      fallbackArmy: {
        category: "Knight" as never,
        tier: 1 as never,
        troopCount: 10,
        onChainStamina: { amount: 10n, updatedTick: 5 },
      },
    });
    expect(withId?.boosts?.incr_stamina_regen_percent_num).toBe(5000);

    // Cleanup
    useArmyStaminaSourceStore.setState({ authoritativeSources: {} });
  });
});
