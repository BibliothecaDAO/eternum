import { describe, expect, it } from "vitest";
import { ResourcesIds, TroopType, TroopTier, type Troops } from "@bibliothecadao/types";
import { getArmyRelicEffects, getStructureArmyRelicEffects, getStructureRelicEffects } from "./relic";

const troops = (): Troops => ({
  category: TroopType.Knight,
  tier: TroopTier.T1,
  count: 100n,
  battle_cooldown_end: 0,
  stamina: { amount: 10n, updated_tick: 47n },
  boosts: {
    incr_damage_dealt_percent_num: 2000,
    incr_damage_dealt_end_tick: 77,
    decr_damage_gotten_percent_num: 2000,
    decr_damage_gotten_end_tick: 77,
    incr_explore_reward_percent_num: 10000,
    incr_explore_reward_end_tick: 77,
    incr_stamina_regen_percent_num: 5000,
    incr_stamina_regen_tick_count: 30,
  },
});

describe("relic windows in seconds", () => {
  it("keeps all army effects through the last second and expires them together", () => {
    const army = troops();
    expect(getArmyRelicEffects(army, 47)).toHaveLength(4);
    expect(getArmyRelicEffects(army, 76)).toEqual(getArmyRelicEffects(army, 47));
    expect(getArmyRelicEffects(army, 77)).toEqual([]);
    expect(getStructureArmyRelicEffects({ troops: army }, 76)).toHaveLength(1);
    expect(getStructureArmyRelicEffects({ troops: army }, 77)).toEqual([]);
  });
  it("reads a replacement expiry without extending the previous window", () => {
    const army = troops();
    army.boosts.incr_damage_dealt_end_tick = 62;
    expect(getArmyRelicEffects(army, 61).some(({ id }) => id === ResourcesIds.DamageRelic1)).toBe(true);
    expect(getArmyRelicEffects(army, 62).some(({ id }) => id === ResourcesIds.DamageRelic1)).toBe(false);
  });
  it("expires all production families at their end second", () => {
    const bonus = {
      game_id: 1,
      entity_id: 1n,
      incr_resource_rate_percent_num: 2000,
      incr_resource_rate_end_tick: 77,
      incr_labor_rate_percent_num: 2000,
      incr_labor_rate_end_tick: 77,
      incr_troop_rate_percent_num: 1500,
      incr_troop_rate_end_tick: 77,
    };
    expect(getStructureRelicEffects(bonus, 76)).toHaveLength(3);
    expect(getStructureRelicEffects(bonus, 77)).toEqual([]);
    bonus.incr_troop_rate_end_tick = 62;
    expect(getStructureRelicEffects(bonus, 62)).toHaveLength(2);
  });
});
