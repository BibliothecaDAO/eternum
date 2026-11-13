import { setBlockTimestampSource } from "./timestamp";
import { dayOf, readExpeditionRules } from "./expeditions";
import explorerFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
afterEach(() => setBlockTimestampSource(null));
import { afterEach, expect, it } from "vitest";
import { BiomeType, BiomeTypeToId, TileOccupier } from "@bibliothecadao/types";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { NativeFactStore } from "../client/native-fact-store";
import { WorldSpatialProjection } from "../sync/world-spatial-projection";
import { getTileAt } from "./tile";
import { currentArmy, currentResourceWeight, deepCenter, deepTicksLeft, deepTiles } from "./deep";

function map() {
  setBlockTimestampSource(() => 350);
  const store = new NativeFactStore();
  store.applyFacts([
    {
      model: "GameRegistry",
      key: "1",
      value: {
        game_id: 1,
        name: 1,
        preset_id: 3,
        settled: false,
        ready: true,
        dev_mode_on: false,
        start_settling_at: 0,
        start_main_at: 300,
        end_at: 100000,
        end_grace_seconds: 0,
        seed: 1,
      },
    },
    { model: "SliceRules", key: "1", value: { ...preset.rules, game_id: 1, day_unit_seconds: 100 } },
    {
      model: "SettlementRules",
      key: "1",
      value: { game_id: 1, registration_start: 1, registration_limit: 2, spacing: 1024, mode: "Single" },
    },
  ]);
  return store;
}

it("reads all 2,500 fixed Deep hexes without a reveal row and keeps its boundary closed", () => {
  const store = map();
  const keys = [...deepTiles(store)];
  expect(keys).toHaveLength(2500);
  expect(new Set(keys.map((key) => `${key.col}:${key.row}`)).size).toBe(2500);
  for (const key of keys) {
    expect(getTileAt(store, key.alt, key.col, key.row, key.game_id)?.biome).toBe(BiomeTypeToId[BiomeType.Underground]);
  }
  expect([...store.rows("TileOpt")]).toEqual([]);
  const center = deepCenter(1024);
  for (const [col, row] of [
    [center.col - 26, center.row],
    [center.col + 25, center.row],
    [center.col, center.row - 26],
    [center.col, center.row + 25],
  ])
    expect(getTileAt(store, false, col, row, 1)).toBeUndefined();
  expect(getTileAt(store, true, center.col, center.row, 1)).toBeUndefined();
});

it("projects the full fixed map and keeps one tile when an occupant arrives and leaves", () => {
  const store = map();
  const projection = new WorldSpatialProjection({ store });
  projection.start();
  try {
    const center = deepCenter(1024);
    const bounds = { alt: false, minCol: 0, maxCol: 1024, minRow: 3072, maxRow: 4095 };
    expect(projection.getTilesInBounds(bounds)).toHaveLength(2500);
    store.applyFacts([
      { model: "ArmyDay", key: "7", value: { game_id: 1, explorer_id: 7, day: 0 } },
      {
        model: "TileOccupancy",
        key: "1",
        value: {
          game_id: 1,
          alt: false,
          ...center,
          entity_id: "7",
          category: TileOccupier.ExplorerKnightT1,
          is_structure: false,
        },
      },
    ]);
    expect(projection.getTilesInBounds(bounds)).toHaveLength(2500);
    expect(getTileAt(store, false, center.col, center.row, 1)?.occupier_id).toBe(7);
    store.applyFacts([{ model: "TileOccupancy", key: "1", value: null }]);
    expect(projection.getTilesInBounds(bounds)).toHaveLength(2500);
    expect(getTileAt(store, false, center.col, center.row, 1)?.occupier_id).toBe(0);
    store.applyFacts([{ model: "SliceRules", key: "1", value: { ...preset.rules, game_id: 1, day_unit_seconds: 0 } }]);
    expect(projection.getTilesInBounds(bounds)).toEqual([]);
  } finally {
    projection.dispose();
  }
});

it.each(["rollover", "late snapshot"])(
  "excludes another home's expired shared army after %s without deleting its facts",
  (arrival) => {
    const store = map();
    let now = 350;
    setBlockTimestampSource(() => now);
    const tomorrow = dayOf(readExpeditionRules(store, 1)!, now)!.end;
    const center = deepCenter(1024);
    const army = (id: number, day: number, col: number) => [
      { model: "ArmyDay", key: String(id), value: { game_id: 1, explorer_id: id, day } },
      {
        model: "ExplorerTroops",
        key: String(id),
        value: {
          ...explorerFixture.expected.value,
          game_id: 1,
          explorer_id: id,
          owner: 2,
          troops: { ...explorerFixture.expected.value.troops, count: 3000n },
        },
      },
      {
        model: "TileOccupancy",
        key: String(id),
        value: {
          game_id: 1,
          alt: false,
          col,
          row: center.row,
          entity_id: id,
          category: TileOccupier.ExplorerKnightT1,
          is_structure: false,
        },
      },
    ];
    store.applyFacts(army(81, 0, center.col));
    if (arrival === "late snapshot") now = tomorrow;
    const projection = new WorldSpatialProjection({ store });
    projection.start();
    const changes: number[] = [];
    projection.subscribeArmies((batch) => changes.push(batch.length));
    try {
      if (arrival === "rollover") {
        expect(getTileAt(store, false, center.col, center.row, 1)?.occupier_id).toBe(81);
        expect(projection.getArmy(81)?.entityId).toBe(81);
      }
      now = tomorrow;
      projection.refreshTime();
      expect(getTileAt(store, false, center.col, center.row, 1)?.occupier_id).toBe(0);
      expect(projection.getArmy(81)).toBeUndefined();
      const expiryChanges = arrival === "rollover" ? [1] : [];
      expect(changes).toEqual(expiryChanges);
      projection.refreshTime();
      expect(changes).toEqual(expiryChanges);
      expect(store.require("ArmyDay", { game_id: 1, explorer_id: 81 }).day).toBe(0n);
      expect(store.require("TileOccupancy", { game_id: 1, alt: false, ...center }).entity_id).toBe(81n);
      store.applyFacts(army(82, 1, center.col + 1));
      expect(getTileAt(store, false, center.col + 1, center.row, 1)?.occupier_id).toBe(82);
      expect(projection.getArmy(82)?.entityId).toBe(82);
      projection.flush();
      expect(changes).toEqual([...expiryChanges, 1]);
    } finally {
      projection.dispose();
    }
  },
);

it("charges each Deep tick once, clamps at death and uses the primary count when given a derived army", () => {
  const store = map();
  let now = 350;
  setBlockTimestampSource(() => now);
  const center = deepCenter(1024);
  store.applyFacts([
    {
      model: "SliceRules",
      key: "1",
      value: {
        ...store.require("SliceRules", { game_id: 1 }),
        tick_config: { ...preset.rules.tick_config, armies_tick_in_seconds: 120 },
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
        loss_per_tick: 200n,
        quarry_per_tick: 500n,
        altar_per_tick: 5,
        altar_threshold: 1500,
      },
    },
    {
      model: "ResourceWeight",
      key: "81",
      value: {
        game_id: 1,
        entity_id: 81,
        capacity: 500n * BigInt(preset.rules.capacity_config.troop_capacity),
        weight: 0n,
      },
    },
    { model: "ArmyDay", key: "81", value: { game_id: 1, explorer_id: 81, day: 0 } },
    { model: "DeepArmy", key: "81", value: { game_id: 1, explorer_id: 81, last_tick: 2 } },
    {
      model: "ExplorerTroops",
      key: "81",
      value: {
        ...explorerFixture.expected.value,
        game_id: 1,
        explorer_id: 81,
        troops: { ...explorerFixture.expected.value.troops, count: 500n },
      },
    },
    {
      model: "TileOccupancy",
      key: "81",
      value: {
        game_id: 1,
        ...center,
        alt: false,
        entity_id: 81,
        category: TileOccupier.ExplorerKnightT1,
        is_structure: false,
      },
    },
  ]);
  const read = () => store.require("ExplorerTroops", { game_id: 1, explorer_id: 81 });
  const projection = new WorldSpatialProjection({ store });
  projection.start();
  try {
    expect(currentArmy(store, read()).troops.count).toBe(500n);
    now = 360;
    expect(currentArmy(store, read()).troops.count).toBe(300n);
    expect(currentResourceWeight(store, store.require("ResourceWeight", { game_id: 1, entity_id: 81 })).capacity).toBe(
      300n * BigInt(preset.rules.capacity_config.troop_capacity),
    );
    expect(currentArmy(store, currentArmy(store, read())).troops.count).toBe(300n);
    expect(read().troops.count).toBe(500n);
    store.applyFacts([
      { model: "ExplorerTroops", key: "81", value: { ...read(), troops: { ...read().troops, count: 300n } } },
      {
        model: "ResourceWeight",
        key: "81",
        value: {
          game_id: 1,
          entity_id: 81,
          capacity: 300n * BigInt(preset.rules.capacity_config.troop_capacity),
          weight: 0n,
        },
      },
      { model: "DeepArmy", key: "81", value: { game_id: 1, explorer_id: 81, last_tick: 3 } },
    ]);
    expect(currentArmy(store, read()).troops.count).toBe(300n);
    now = 480;
    projection.refreshTime();
    expect(currentArmy(store, read()).troops.count).toBe(100n);
    expect(projection.getArmy(81)?.entityId).toBe(81);
    now = 600;
    projection.refreshTime();
    expect(currentArmy(store, read()).troops.count).toBe(0n);
    expect(projection.getArmy(81)).toBeUndefined();
    expect(getTileAt(store, false, center.col, center.row, 1)?.occupier_id).toBe(0);
    expect(read().troops.count).toBe(300n);
  } finally {
    projection.dispose();
  }
});

it("gives a Deep army the ticks it has left, until its troops are gone or its day ends", () => {
  const store = map();
  const army = (count: bigint, explorer_id = 82) => ({
    ...explorerFixture.expected.value,
    game_id: 1,
    explorer_id,
    troops: { ...explorerFixture.expected.value.troops, count },
  });
  store.applyFacts([
    {
      model: "SliceRules",
      key: "1",
      value: {
        ...store.require("SliceRules", { game_id: 1 }),
        tick_config: { ...preset.rules.tick_config, armies_tick_in_seconds: 120 },
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
        loss_per_tick: 200n,
        quarry_per_tick: 500n,
        altar_per_tick: 5,
        altar_threshold: 1500,
      },
    },
    { model: "ExplorerTroops", key: "82", value: army(500n) },
    { model: "ArmyDay", key: "82", value: { game_id: 1, explorer_id: 82, day: 0 } },
    { model: "DeepArmy", key: "82", value: { game_id: 1, explorer_id: 82, last_tick: 2 } },
    { model: "ExplorerTroops", key: "83", value: army(1_000_000_000n, 83) },
    { model: "ArmyDay", key: "83", value: { game_id: 1, explorer_id: 83, day: 0 } },
    { model: "DeepArmy", key: "83", value: { game_id: 1, explorer_id: 83, last_tick: 2 } },
    { model: "ExplorerTroops", key: "84", value: army(500n, 84) },
  ]);
  const read = (explorer_id: number) => store.require("ExplorerTroops", { game_id: 1, explorer_id });
  const day = dayOf(readExpeditionRules(store, 1)!, 350)!;
  // 500 troops at 200 a tick: three ticks, the last taking what is left, at 600 (ticks of 120 s from 360).
  expect(deepTicksLeft(store, read(82), 350)).toEqual({ left: 3, seconds: 250 });
  expect(deepTicksLeft(store, read(82), 360)).toEqual({ left: 2, seconds: 240 });
  expect(deepTicksLeft(store, read(82), 600)).toEqual({ left: 0, seconds: 0 });
  // An army its troops would carry past its day has the ticks to the day's end.
  const toDayEnd = Math.floor(day.end / 120) - 2;
  expect(deepTicksLeft(store, read(83), 350)).toEqual({ left: toDayEnd, seconds: (2 + toDayEnd) * 120 - 350 });
  // An army on no Deep tick has none to count.
  expect(deepTicksLeft(store, read(84), 350)).toBeNull();
});
