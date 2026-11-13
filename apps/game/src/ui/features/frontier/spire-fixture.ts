import { entityHomeNamespace, expeditionRealmSite, readExpeditionRules, seasonDay } from "@bibliothecadao/eternum";
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
 * A spire realm 7 found on a layer today, as discovery writes it (logic/spires.cairo): its ExpeditionSpire row, counting
 * the reveals made, and the tile it occupies as a spire.
 */
export const foundSpireFacts = (
  spire: { col: number; row: number },
  { day, depth = 0, reveals = 3 }: { day: number; depth?: number; reveals?: number },
) => [
  {
    model: "ExpeditionSpire",
    key: `0x5b${depth}`,
    value: {
      game_id: 1,
      structure_id: 7,
      epoch: day,
      depth,
      reveals,
      location: { alt: false, x: spire.col, y: spire.row },
    },
  },
  {
    model: "TileOccupancy",
    key: `0x5c${depth}`,
    value: { game_id: 1, alt: false, ...spire, entity_id: 0, category: TileOccupier.Spire, is_structure: false },
  },
];

/**
 * Realm 7's day 0, with Spire lore known, Ethereal II reached on an earlier day, its spire found on the surface beside
 * its site today, and its army standing
 * beside the spire or three tiles off it (a found spire occupies its own tile), holding the stamina given. The spire card's tests and the game
 * lab's spire both play it.
 */
export const spireDay = ({
  stamina = 100n,
  standing = "beside",
  spacing,
}: { stamina?: bigint; standing?: "beside" | "away"; spacing?: number } = {}) => {
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
  const day = seasonDay(rules, SPIRE_DAY_NOW)!;
  const site = expeditionRealmSite(rules, entityHomeNamespace(7), SPIRE_DAY_NOW)!;
  const [spire] = getNeighborHexes(site.col, site.row);
  const [beside] = getNeighborHexes(spire.col, spire.row).filter((hex) => hex.col !== site.col || hex.row !== site.row);
  const armyTile = {
    beside: { col: beside.col, row: beside.row },
    away: { col: spire.col + 3, row: spire.row },
  }[standing];
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  store.applyFacts([
    // An earlier day took the realm's armies down to Ethereal II (record_depth): its layers are World, I and II.
    { model: "Structure", key: "0x7", value: { ...realm, metadata: { ...realm.metadata, deepest_depth: 2 } } },
    // research.cairo: the depth row's tier sits at bit 48; its first tier is Spire lore.
    { model: "RealmKnowledge", key: "0xd", value: { game_id: 1, structure_id: 7, learned: String(1n << 48n) } },
    depthRules(1),
    depthRules(2),
    depthRules(3),
    ...foundSpireFacts({ col: spire.col, row: spire.row }, { day }),
    { model: "TileOccupancy", key: "0x75", value: null },
    {
      model: "TileOccupancy",
      key: SPIRE_ARMY_TILE_KEY,
      value: { game_id: 1, alt: false, ...armyTile, entity_id: SPIRE_ARMY, category: 15, is_structure: false },
    },
  ] as never);
  return { store, rules, spire: { col: spire.col, row: spire.row }, armyTile };
};
