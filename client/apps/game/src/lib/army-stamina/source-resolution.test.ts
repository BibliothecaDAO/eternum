import { TroopTier, TroopType, type Troops } from "@bibliothecadao/types";
import { beforeEach, describe, expect, it } from "vitest";

import { selectFreshestTroopsSnapshot } from "./source-resolution";
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

describe("selectFreshestTroopsSnapshot", () => {
  beforeEach(() => {
    useArmyStaminaSourceStore.setState({ pendingSources: {} });
  });

  it("uses the live RECS row when no pending movement exists", () => {
    const liveTroops = buildTroops({ amount: 90n, updatedTick: 100n });

    expect(selectFreshestTroopsSnapshot({ entityId: 1234, liveTroops })).toBe(liveTroops);
  });

  it("uses pending stamina while it is newer than live RECS", () => {
    const liveTroops = buildTroops({ amount: 120n, updatedTick: 100n });
    const selected = selectFreshestTroopsSnapshot({
      entityId: 9999,
      liveTroops,
      pendingStamina: { amount: 90n, updatedTick: 101 },
    });

    expect(selected).not.toBe(liveTroops);
    expect(selected?.stamina).toMatchObject({ amount: 90n, updated_tick: 101n });
  });

  it("keeps same-tick pending stamina until live confirms its amount", () => {
    const liveTroops = buildTroops({ amount: 80n, updatedTick: 100n });
    const selected = selectFreshestTroopsSnapshot({
      entityId: 4321,
      liveTroops,
      pendingStamina: { amount: 60n, updatedTick: 100 },
    });

    expect(selected?.stamina).toMatchObject({ amount: 60n, updated_tick: 100n });
  });

  it("drops pending stamina once live RECS confirms the tick and amount", () => {
    const liveTroops = buildTroops({ amount: 40n, updatedTick: 103n });

    expect(
      selectFreshestTroopsSnapshot({
        entityId: 987,
        liveTroops,
        pendingStamina: { amount: 40n, updatedTick: 103 },
      }),
    ).toBe(liveTroops);
  });

  it("rejects an expired pending record from the single pending-state store", () => {
    const entityId = 5555;
    const liveTroops = buildTroops({ amount: 70n, updatedTick: 200n });
    useArmyStaminaSourceStore.setState({
      pendingSources: {
        [String(entityId)]: {
          source: "pending",
          entityId,
          amount: 20n,
          updatedTick: 201,
          capturedAtMs: Date.now() - 60_001,
        },
      },
    });

    expect(selectFreshestTroopsSnapshot({ entityId, liveTroops })).toBe(liveTroops);
  });
});
