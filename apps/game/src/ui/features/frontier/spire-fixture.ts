import { expeditionSpireTile, readExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { getNeighborHexes, TileOccupier } from "@bibliothecadao/types";

import { campBeside } from "./sites/site-fixture";

/** The fixture realm's army, and the second of day 0 the fixture is read at. */
export const SPIRE_ARMY = 201;
/** The key of the army's tile row, as the spire's day places it: a game that moves the army rewrites this row. */
export const SPIRE_ARMY_TILE_KEY = "0x904";
export const SPIRE_DAY_NOW = 350;

const depthRules = (depth: number) => ({
  model: "DepthRules",
  key: `0x90${depth}`,
  value: {
    game_id: 1,
    depth,
    reveal_percent: 100,
    reveal_cap: 1000,
    rift_essence_bps: 15000,
    site_guard_lower: 1,
    site_guard_upper: 2,
    rift_guard_lower: 1,
    rift_guard_upper: 2,
    reveal_site_neighbors: false,
    chest: { common: 10000, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
    guard_step: 1,
    beast_weak_lower: 300,
    beast_weak_upper: 350,
    beast_strong_lower: 450,
    beast_strong_upper: 550,
  },
});

/**
 * Realm 7's day 0 (its spire on the home ring around its site), with Ethereal I and II researched, free entry, and its army standing beside the spire, on its tile or three tiles off it,
 * holding the stamina given. The spire card's tests and the game lab's spire both play it.
 */
export const spireDay = ({
  stamina = 100n,
  standing = "beside",
  spacing,
}: { stamina?: bigint; standing?: "beside" | "on" | "away"; spacing?: number } = {}) => {
  const { store } = campBeside("Camp", true, stamina);
  // The regions' width: the deploy fixture's small one unless the game needs Frontier's own.
  if (spacing !== undefined)
    store.applyFacts([
      {
        model: "SettlementRules",
        key: "0x2",
        value: { ...store.require("SettlementRules", { game_id: 1 }), spacing },
      },
    ] as never);
  const rules = readExpeditionRules(store, 1)!;
  const spire = expeditionSpireTile(rules, store.require("Structure", { game_id: 1, entity_id: 7 }), SPIRE_DAY_NOW)!;
  const [beside] = getNeighborHexes(spire.col, spire.row);
  const armyTile = {
    beside: { col: beside.col, row: beside.row },
    on: { col: spire.col, row: spire.row },
    away: { col: spire.col + 3, row: spire.row },
  }[standing];
  store.applyFacts([
    { model: "RealmKnowledge", key: "0xd", value: { game_id: 1, structure_id: 7, learned: String(3n << 48n) } },
    depthRules(1),
    depthRules(2),
    depthRules(3),
    { model: "TileOccupancy", key: "0x75", value: null },
    {
      model: "TileOccupancy",
      key: SPIRE_ARMY_TILE_KEY,
      value: { game_id: 1, alt: false, ...armyTile, entity_id: SPIRE_ARMY, category: 15, is_structure: false },
    },
  ] as never);
  return { store, rules, spire, armyTile };
};

/** A recorded discovery replaces the home-ring portal on the selected expedition layer. */
export const applySpireDiscovery = (store: NativeFactStore, depth: 0 | 1 | 2) => {
  const rules = readExpeditionRules(store, 1)!;
  const surface = expeditionSpireTile(rules, store.require("Structure", { game_id: 1, entity_id: 7 }), SPIRE_DAY_NOW)!;
  const spire = { col: surface.col + 2, row: surface.row + depth * rules.spacing };
  const [armyTile] = getNeighborHexes(spire.col, spire.row);
  const occupancy = store.entityOccupancy(1, SPIRE_ARMY)!;
  store.applyFacts([
    {
      model: "ExpeditionSpire",
      key: "0x5f01",
      value: {
        game_id: 1,
        structure_id: 7,
        epoch: 0,
        depth,
        reveals: 3,
        location: { x: spire.col, y: spire.row, alt: false },
      },
    },
    {
      model: "TileOccupancy",
      key: "0x5f02",
      value: { game_id: 1, entity_id: 801, category: TileOccupier.Spire, is_structure: false, alt: false, ...spire },
    },
    { model: "TileOccupancy", key: store.wireKeyOf("TileOccupancy", occupancy)!, value: null },
    {
      model: "TileOccupancy",
      key: "0x5f03",
      value: {
        game_id: 1,
        entity_id: SPIRE_ARMY,
        category: TileOccupier.ExplorerKnightT1,
        is_structure: false,
        alt: false,
        col: armyTile.col,
        row: armyTile.row,
      },
    },
  ] as never);
  return { store, rules, spire, armyTile };
};

export const discoveredSpireDay = (depth: 0 | 1 | 2 = 0) =>
  applySpireDiscovery(spireDay({ spacing: 100 }).store, depth);
