import { describe, expect, it } from "vitest";
import { BiomeType } from "@bibliothecadao/types";

import { NativeFactStore } from "../client/native-fact-store";
import { entityMapPosition, storedBiomeAt } from "./tile";

// A far-east tile a playtest army stood on (shard C game 1, realm 7,603's column): the chain stored Shrubland (9) where
// the client's own noise said Ocean, and drew the army as a boat.
const FAR_EAST = { col: 760245, row: 52, data: 0x20017336a0000006812000000aa1en };
const storeWith = (row: object | undefined) => ({ get: () => row }) as unknown as NativeFactStore;

describe("stored biome", () => {
  it("reads a revealed tile's biome from the row the chain stored", () => {
    const store = storeWith({ game_id: 1, alt: false, col: FAR_EAST.col, row: FAR_EAST.row, data: FAR_EAST.data });
    expect(storedBiomeAt(store, false, FAR_EAST.col, FAR_EAST.row, 1)).toBe(BiomeType.Shrubland);
  });

  it("names no biome for a tile no command has revealed", () => {
    expect(storedBiomeAt(storeWith(undefined), false, FAR_EAST.col, FAR_EAST.row, 1)).toBeUndefined();
  });
});

it("resolves an occupied u64 entity without converting its identity to a floating-point number", () => {
  const entity = (1n << 56n) + 19n;
  const store = new NativeFactStore();
  store.applyFacts([
    {
      model: "TileOccupancy",
      key: "0x12",
      value: { game_id: 1, alt: false, col: 12, row: 34, entity_id: entity, category: 15, is_structure: false },
    },
  ]);
  expect(entityMapPosition(store, 1, entity)).toEqual({ x: 12, y: 34, alt: false });
  expect(store.entityOccupancy(1, entity)?.entity_id).toBe(entity);
});

it("accepts safe numeric native keys with the same identity as bigint and refuses unsafe numeric keys", () => {
  const store = new NativeFactStore();
  const id = 4294967297n;
  store.applyFacts([
    {
      model: "ArmyProgress",
      key: "0x13",
      value: {
        game_id: 1,
        explorer_id: id,
        xp: 0,
        battle: 0,
        logistics: 0,
        scouting: 0,
        scouting_kinds: 0,
        homecoming: 0,
      },
    },
  ]);
  expect(store.get("ArmyProgress", { game_id: 1, explorer_id: Number(id) })).toBe(
    store.get("ArmyProgress", { game_id: 1, explorer_id: id }),
  );
  expect(store.get("ArmyProgress", { game_id: 1, explorer_id: id })?.explorer_id).toBe(id);
  expect(() => store.get("ArmyProgress", { game_id: 1, explorer_id: Number.MAX_SAFE_INTEGER + 1 })).toThrow(
    "Unsafe integer",
  );
});
