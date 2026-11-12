import { expect, it } from "vitest";
import { deepSites, TileOccupier } from "@bibliothecadao/types";
import { NativeFactStore } from "../native-fact-store";
import { configManager } from "../../managers/config-manager";
import { readDeepSites } from "./deep-sites";
import { dayOf, readExpeditionRules } from "../../utils/expeditions";
import { getTileAt } from "../../utils/tile";
import preset from "../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";

function fixture() {
  configManager.setActiveGame(1, 1);
  const store = new NativeFactStore();
  store.applyFacts([
    { model: "SliceRules", key: "1", value: { ...preset.rules, game_id: 1, day_unit_seconds: 60 } },
    {
      model: "SettlementRules",
      key: "1",
      value: { game_id: 1, spacing: 100, mode: "Single", registration_start: 0, registration_limit: 0 },
    },
    {
      model: "GameRegistry",
      key: "1",
      value: {
        game_id: 1,
        name: 1,
        preset_id: 1,
        settled: false,
        ready: true,
        dev_mode_on: false,
        start_settling_at: 0,
        start_main_at: 300,
        end_at: 2700,
        end_grace_seconds: 0,
        seed: 42,
      },
    },
    {
      model: "DeepRules",
      key: "1",
      value: {
        game_id: 1,
        foundation: { alt: false, x: 25, y: 35 },
        quarry: { alt: false, x: 12, y: 20 },
        altar: { alt: false, x: 38, y: 20 },
        beast_count: 10000n,
      },
    },
  ]);
  for (const [index, kind] of deepSites.entries()) {
    const entity_id = index + 1;
    const local = store.require("DeepRules", { game_id: 1 })[kind.position];
    store.applyFacts([
      { model: "DeepSite", key: String(entity_id), value: { game_id: 1, entity_id, kind: kind.id, day: 0 } },
      {
        model: "TileOccupancy",
        key: String(entity_id),
        value: {
          game_id: 1,
          entity_id,
          category: TileOccupier.DeepSite,
          is_structure: false,
          alt: false,
          col: 25 + local.x,
          row: 325 + local.y,
        },
      },
      {
        model: "Guard",
        key: String(entity_id),
        value: {
          game_id: 1,
          structure_id: entity_id,
          slot: 0,
          destroyed_tick: 0,
          troops: {
            category: "Knight",
            tier: "T1",
            count: BigInt([4000, 0, 10000][index]!),
            battle_cooldown_end: 0,
            stamina: { Inline: { amount: 0, settled_at: 300, remainder: 0 } },
            boosts: {
              incr_stamina_regen_percent_num: 0,
              incr_stamina_regen_seconds_left: 0,
              incr_explore_reward_percent_num: 0,
              incr_explore_reward_end_at: 0,
              incr_damage_dealt_percent_num: 0,
              incr_damage_dealt_end_at: 0,
              decr_damage_gotten_percent_num: 0,
              decr_damage_gotten_end_at: 0,
            },
          },
        },
      },
    ]);
  }
  return store;
}

it("keeps all three sites visible after a beast is defeated and reads its lasting losses", () => {
  const store = fixture();
  const sites = readDeepSites(store, 350);
  expect(sites.map(({ name, beastTroops }) => ({ name, beastTroops }))).toEqual([
    { name: "Foundation", beastTroops: 4000n },
    { name: "Quarry", beastTroops: 0n },
    { name: "Altar", beastTroops: 10000n },
  ]);
  for (const site of sites) {
    expect(getTileAt(store, site.position.alt, site.position.x, site.position.y, 1)?.occupier_id).toBe(Number(site.id));
  }
  const calendar = readExpeditionRules(store, 1)!;
  const tomorrow = dayOf(calendar, 350)!.end;
  expect(readDeepSites(store, tomorrow).map(({ id, beastTroops, day }) => ({ id, beastTroops, day }))).toEqual([
    { id: 1n, beastTroops: 10000n, day: 1 },
    { id: 2n, beastTroops: 10000n, day: 1 },
    { id: 3n, beastTroops: 10000n, day: 1 },
  ]);
  expect(store.require("Guard", { game_id: 1, structure_id: 2, slot: 0 }).troops.count).toBe(0n);
  expect(readDeepSites(store, 299)).toEqual([]);
  expect(readDeepSites(store, 2700)).toEqual([]);
});

it("refuses incomplete or duplicate site facts instead of hiding a missing catalog member", () => {
  const store = fixture();
  store.applyFacts([{ model: "DeepSite", key: "2", value: null }]);
  expect(() => readDeepSites(store, 350)).toThrow("Incomplete Deep site facts");
  store.applyFacts([
    { model: "DeepSite", key: "2", value: { game_id: 1, entity_id: 2, kind: deepSites[0].id, day: 0 } },
  ]);
  expect(() => readDeepSites(store, 350)).toThrow("Expected one Foundation site");
});
