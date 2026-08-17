import { TroopTier, TroopType, type Troops } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { selectFreshestTroopsSnapshot } from "./source-resolution";

const liveTroops: Troops = {
  category: TroopType.Crossbowman,
  tier: TroopTier.T1,
  count: 1500n,
  stamina: { amount: 90n, updated_tick: 100n },
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
};

describe("selectFreshestTroopsSnapshot", () => {
  it("reads the sole live RECS source", () => {
    expect(selectFreshestTroopsSnapshot({ entityId: 1234, liveTroops })).toBe(liveTroops);
    expect(selectFreshestTroopsSnapshot({ entityId: 1234, liveTroops: null })).toBeNull();
  });
});
