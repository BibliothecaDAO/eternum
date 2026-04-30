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
    useArmyStaminaSourceStore.setState({ pendingSources: {}, authoritativeSources: {} });
  });

  it("ignores pending source when live RECS has equal or newer updated_tick", () => {
    // Scenario: User did a move 1 tick ago. Pending was set with amount=90 updatedTick=T.
    // Onchain has caught up: live RECS has amount=90 updated_tick=T (same tick).
    // The pending is now obsolete - live reflects the actual onchain state.
    // selectFreshestTroopsSnapshot should return live, not pending, so that
    // regen calculation in getStamina uses the correct updated_tick.
    const entityId = 1234;
    const actionTick = 100;

    // Pending prediction from the user's action
    useArmyStaminaSourceStore.setState({
      pendingSources: {
        [String(entityId)]: {
          source: "pending",
          entityId,
          amount: 90n,
          updatedTick: actionTick,
          capturedAtMs: Date.now(),
        },
      },
      authoritativeSources: {},
    });

    // Live RECS has the same onchain state (caught up)
    const liveTroops = buildTroops({ amount: 90n, updatedTick: BigInt(actionTick) });

    const selected = selectFreshestTroopsSnapshot({
      entityId,
      liveTroops,
    });

    // Should pick live troops (not the pending-wrapped troops)
    // Both would have the same amount/tick in this case, but we want the
    // original live troops object returned.
    expect(selected).toBe(liveTroops);
  });

  it("ignores obsolete pending when onchain has advanced past pending tick", () => {
    // Scenario: User's pending is from tick 100, onchain has since been updated
    // to tick 150 (maybe another action, or just Torii catching up).
    // selectFreshestTroopsSnapshot should use live, not stale pending.
    const entityId = 5678;

    useArmyStaminaSourceStore.setState({
      pendingSources: {
        [String(entityId)]: {
          source: "pending",
          entityId,
          amount: 90n,
          updatedTick: 100,
          capturedAtMs: Date.now(),
        },
      },
      authoritativeSources: {},
    });

    const liveTroops = buildTroops({ amount: 120n, updatedTick: 150n });

    const selected = selectFreshestTroopsSnapshot({
      entityId,
      liveTroops,
    });

    expect(selected).toBe(liveTroops);
  });

  it("still uses pending when it is strictly newer than live", () => {
    // Scenario: User just clicked; pending is at tick T, live RECS is still at T-1.
    // Pending must win to give optimistic UI feedback.
    const entityId = 9999;

    useArmyStaminaSourceStore.setState({
      pendingSources: {
        [String(entityId)]: {
          source: "pending",
          entityId,
          amount: 90n,
          updatedTick: 101,
          capturedAtMs: Date.now(),
        },
      },
      authoritativeSources: {},
    });

    const liveTroops = buildTroops({ amount: 120n, updatedTick: 100n });

    const selected = selectFreshestTroopsSnapshot({
      entityId,
      liveTroops,
    });

    // Pending wins — live hasn't caught up yet
    expect(selected).not.toBe(liveTroops);
    expect(selected?.stamina?.amount).toBe(90n);
    expect(selected?.stamina?.updated_tick).toBe(101n);
  });

  it("keeps pending when live RECS has the same tick but a different stamina amount", () => {
    const entityId = 4321;
    const actionTick = 100;

    useArmyStaminaSourceStore.setState({
      pendingSources: {
        [String(entityId)]: {
          source: "pending",
          entityId,
          amount: 60n,
          updatedTick: actionTick,
          capturedAtMs: Date.now(),
        },
      },
      authoritativeSources: {},
    });

    const liveTroops = buildTroops({ amount: 80n, updatedTick: BigInt(actionTick) });

    const selected = selectFreshestTroopsSnapshot({
      entityId,
      liveTroops,
    });

    expect(selected).not.toBe(liveTroops);
    expect(selected?.stamina?.amount).toBe(60n);
    expect(selected?.stamina?.updated_tick).toBe(BigInt(actionTick));
  });
});
