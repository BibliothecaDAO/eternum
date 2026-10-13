import { expect, test } from "bun:test";
import { getStructureRelicEffects } from "@bibliothecadao/eternum";

test("the runtime reads relic end seconds independently of head cadence", () => {
  const row = {
    game_id: 1,
    entity_id: 2n,
    incr_resource_rate_percent_num: 2000,
    incr_resource_rate_end_tick: 77,
    incr_labor_rate_percent_num: 2000,
    incr_labor_rate_end_tick: 77,
    incr_troop_rate_percent_num: 1500,
    incr_troop_rate_end_tick: 77,
  };
  for (const step of [1, 2]) {
    for (let floor = 47; floor < 77; floor += step) expect(getStructureRelicEffects(row, floor)).toHaveLength(3);
    expect(getStructureRelicEffects(row, 77)).toEqual([]);
  }
  row.incr_resource_rate_end_tick = 62;
  expect(getStructureRelicEffects(row, 61)).toHaveLength(3);
  expect(getStructureRelicEffects(row, 62)).toHaveLength(2);
});
