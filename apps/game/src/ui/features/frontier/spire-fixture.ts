import { expeditionSpireTile, readExpeditionRules } from "@bibliothecadao/eternum";
import { getNeighborHexes } from "@bibliothecadao/types";

import { campBeside } from "./sites/site-fixture";

/** The fixture realm's army, and the second of day 0 the fixture is read at. */
export const SPIRE_ARMY = 201;
export const SPIRE_DAY_NOW = 350;

const depthRules = (depth: number, entry: number) => ({
  model: "DepthRules",
  key: `0x90${depth}`,
  value: {
    game_id: 1,
    depth,
    entry_stamina: entry,
    reveal_percent: 100,
    site_guard_lower: 1,
    site_guard_upper: 2,
    reveal_site_neighbors: false,
    chest: { common: 10000, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
    ruin_guard_lower: 1,
    ruin_guard_upper: 2,
    guard_step: 1,
    beast_weak_lower: 300,
    beast_weak_upper: 350,
    beast_strong_lower: 450,
    beast_strong_upper: 550,
  },
});

/**
 * Realm 7's day 0 (its spire on the home ring around its site), with Ethereal I and II researched and entry costs of
 * 30, 40 and 50 stamina, as Frontier prices them, and its army standing beside the spire, on its tile or three tiles off it,
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
    // research.cairo: the depth row's tier sits at bit 46; Ethereal I and II are researched.
    { model: "RealmKnowledge", key: "0xd", value: { game_id: 1, structure_id: 7, learned: String(2n << 46n) } },
    depthRules(1, 30),
    depthRules(2, 40),
    depthRules(3, 50),
    { model: "TileOccupancy", key: "0x75", value: null },
    {
      model: "TileOccupancy",
      key: "0x904",
      value: { game_id: 1, alt: false, ...armyTile, entity_id: SPIRE_ARMY, category: 15, is_structure: false },
    },
  ] as never);
  return { store, rules, spire, armyTile };
};
