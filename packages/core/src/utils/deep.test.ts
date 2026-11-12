import { expect, it } from "vitest";
import { BiomeType, BiomeTypeToId, TileOccupier } from "@bibliothecadao/types";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { NativeFactStore } from "../client/native-fact-store";
import { WorldSpatialProjection } from "../sync/world-spatial-projection";
import { getTileAt } from "./tile";
import { deepCenter, deepTiles } from "./deep";

function map() {
  const store = new NativeFactStore();
  store.applyFacts([
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
