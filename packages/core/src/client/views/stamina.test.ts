import { gameRegistryRow } from "../../test-support/game-registry";
import { expect, it } from "vitest";
import release from "../../../../../contracts/l3/world-native/schema/release-definition.json";
import {
  nativeBaneConstants,
  nativeOathConstants,
  nativeRaceConstants,
} from "../../../../../contracts/l3/world-native/schema/balance.gen";
import { NativeFactStore } from "../native-fact-store";
import { dayAtIndex } from "../../utils/days";
import { readStaminaEffects } from "./stamina";

const calendar = { seed: 5n, startMainAt: 100, endAt: 10_000, scheduledEndAt: 10_000, dayUnitSeconds: 100 };
const day = dayAtIndex(calendar, 1);
function fixture() {
  const store = new NativeFactStore();
  store.applyFacts([
    { model: "SliceRules", key: "1", value: { ...release.definition.rules, game_id: 1, day_unit_seconds: 100 } },
    {
      model: "GameRegistry",
      key: "1",
      value: gameRegistryRow({ seed: "5", scheduled_end_at: "10000", end_at: "10000" }),
    },
    {
      model: "SettlementRules",
      key: "1",
      value: { game_id: 1, registration_start: 1, registration_limit: 2, spacing: 10, mode: "Single" },
    },
    {
      model: "Structure",
      key: "1:7",
      value: {
        game_id: 1,
        entity_id: 7,
        owner: "0x111",
        resources_packed: 0,
        base: {
          category: 1,
          level: 0,
          created_at: 100,
          troop_max_guard_count: 0,
          troop_max_explorer_count: 0,
          starting_troops_granted: false,
        },
        metadata: { realm_id: 1, village_realm: 0, mine_kind: 0, deepest_depth: 0, has_wonder: false, order: 0 },
      },
    },
    { model: "HomeAspect", key: "1:7", value: { game_id: 1, home: 7, aspect: 1 } },
    {
      model: "BaneRules",
      key: "1",
      value: {
        game_id: 1,
        chance_step: 20,
        quorum_percent: 25,
        beast_percent: 150,
        stamina_percent: 50,
        production_percent: 50,
        quest_counts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 15000],
      },
    },
    { model: "AspectActivity", key: "1:1:0", value: { game_id: 1, aspect: 1, day: 0, active: 4 } },
    { model: "WorldBane", key: "1:1", value: { game_id: 1, day: 1, kind: nativeBaneConstants.MIST_TIDE } },
    {
      model: "RaceRules",
      key: "1",
      value: {
        game_id: 1,
        season_days: 50,
        stage_height: 2000,
        clear_mist_percent: 200,
        second_wind_percent: 200,
        pale_moon_percent: 50,
        spoils_percent: 200,
      },
    },
  ]);
  store.setSnapshot({ gameId: 1, actor: "0x111", complete: true, timestamp: day.start });
  return store;
}

it("multiplies Second Wind and Mist Tide, then restores the Triumph rate at the exact quorum second", () => {
  const store = fixture();
  expect(readStaminaEffects(store, 1, 7, 1n, day.start, 0, 0)).toEqual({
    known: {
      until: day.end,
      windows: [{ start: day.start, end: day.end, rateBps: 5_000 }],
    },
  });
  store.applyFacts([
    {
      model: "TriumphDay",
      key: "1:1:2",
      value: {
        game_id: 1,
        aspect: 1,
        stage: nativeRaceConstants.SECOND_WIND_STAGE,
        day: 1,
      },
    },
  ]);
  expect(readStaminaEffects(store, 1, 7, 1n, day.start, 0, 0)).toEqual({ known: { until: day.end, windows: [] } });
  store.applyFacts([
    {
      model: "BaneProgress",
      key: "1:1:1",
      value: {
        game_id: 1,
        aspect: 1,
        day: 1,
        completed: 1,
        ended_at: day.start + 60,
      },
    },
  ]);
  expect(readStaminaEffects(store, 1, 7, 1n, day.start, 0, 0)).toEqual({
    known: {
      until: day.end,
      windows: [{ start: day.start + 60, end: day.end, rateBps: 20_000 }],
    },
  });
  expect(readStaminaEffects(store, 1, 7, 1n, day.start, 3, 0)).toEqual({ known: { until: day.end, windows: [] } });
});

it("regenerates no faster than Mist Tide allows through a day no command has rolled yet, and at the roll's own rate once rolled", () => {
  const store = fixture();
  store.applyFacts([{ model: "WorldBane", key: "1:1", value: null }]);
  expect(readStaminaEffects(store, 1, 7, 1n, day.start, 0, 0)).toEqual({
    known: { until: day.end, windows: [{ start: day.start, end: day.end, rateBps: 5_000 }] },
  });
  store.applyFacts([{ model: "WorldBane", key: "1:1", value: { game_id: 1, day: 1, kind: 0 } }]);
  expect(readStaminaEffects(store, 1, 7, 1n, day.start, 0, 0)).toEqual({ known: { until: day.end, windows: [] } });
  store.setSnapshot({ gameId: 1, actor: "0x111", complete: false, timestamp: day.start });
  expect(readStaminaEffects(store, 1, 7, 1n, day.start, 0, 0).unknown).toContain("INCOMPLETE_SNAPSHOT");
});

it("ignores a scheduled Triumph after an early finish without changing its calendar identity", () => {
  const store = fixture();
  const game = store.require("GameRegistry", { game_id: 1 });
  store.applyFacts([
    { model: "GameRegistry", key: "1", value: { ...game, end_at: day.start + 90 } },
    {
      model: "TriumphDay",
      key: "1:1:2",
      value: { game_id: 1, aspect: 1, stage: nativeRaceConstants.SECOND_WIND_STAGE, day: 2 },
    },
  ]);
  expect(readStaminaEffects(store, 1, 7, 1n, day.start, 0, 0)).toEqual({
    known: {
      until: day.start + 90,
      windows: [{ start: day.start, end: day.start + 90, rateBps: 5_000 }],
    },
  });
});

it("runs an Enlightenment army's whole day a third faster, under Mist Tide, Second Wind and in the Deep", () => {
  const store = fixture();
  const enlightened = 1 << (nativeOathConstants.ENLIGHTENMENT - 1);
  expect(readStaminaEffects(store, 1, 7, 1n, day.start, 0, enlightened)).toEqual({
    known: { until: day.end, windows: [{ start: day.start, end: day.end, rateBps: 6_667 }] },
  });
  expect(readStaminaEffects(store, 1, 7, 1n, day.start, 3, enlightened)).toEqual({
    known: { until: day.end, windows: [{ start: day.start, end: day.end, rateBps: 13_334 }] },
  });
  store.applyFacts([
    {
      model: "TriumphDay",
      key: "1:1:2",
      value: { game_id: 1, aspect: 1, stage: nativeRaceConstants.SECOND_WIND_STAGE, day: 1 },
    },
  ]);
  expect(readStaminaEffects(store, 1, 7, 1n, day.start, 0, enlightened)).toEqual({
    known: { until: day.end, windows: [{ start: day.start, end: day.end, rateBps: 13_334 }] },
  });
});
