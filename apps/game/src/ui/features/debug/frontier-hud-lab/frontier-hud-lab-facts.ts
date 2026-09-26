import { nativeTileOccupierConstants } from "@bibliothecadao/eternum/game-client";
import { absoluteEpoch } from "@bibliothecadao/eternum/expeditions";
/**
 * A Frontier day in facts: the current Frontier launch's rules, projected from today's preset by `pnpm lab:frontier`
 * through Herald's own projection, plus a hand-built player in the same shapes — one realm with its castle producing
 * labor, two of today's armies and the realm's holdings.
 */
export const LAB_PLAYER = "0x5a11ab";
export const LAB_REALM_ID = 100;
const REALM_TRAIT_ID = 7;
const PRECISION = 1_000_000_000n;
const DAY = 3;

type WireRow = { model: string; value: Record<string, unknown> };

// A glob, not an import: without a generated file the lab says how to make one instead of breaking the build.
const generatedRules = import.meta.glob<WireRow[]>("../../../../../.lab/frontier-rules.json", { import: "default" });

export const loadGeneratedRules = async (): Promise<WireRow[] | null> => {
  const load = Object.values(generatedRules)[0];
  return load ? load() : null;
};

/**
 * The lab's game, clock and every fact in the store's wire form: a unique key per row, each value the full row. The
 * player joins whichever game the generated rules were projected for.
 */
export const buildLabDay = (rules: WireRow[]) => {
  const clock = readLabClock(rules);
  const facts = [...rules, ...playerRows(clock)].map((row, index) => ({
    model: row.model,
    key: `0x${(index + 1).toString(16)}`,
    value: row.value,
  }));
  return { facts, gameId: clock.gameId, nowSeconds: clock.nowSeconds };
};

type LabClock = ReturnType<typeof readLabClock>;

/** Well into day four with a partial tick, so every countdown shows seconds. */
const readLabClock = (rules: WireRow[]) => {
  const slice = requireRow(rules, "SliceRules") as {
    game_id: string;
    epoch_seconds: string;
    tick_config: { armies_tick_in_seconds: string };
  };
  const spacing = Number((requireRow(rules, "SettlementRules") as { spacing: string }).spacing);
  const epochSeconds = Number(slice.epoch_seconds);
  const startMainAt = 20 * epochSeconds;
  const nowSeconds = startMainAt + DAY * epochSeconds + Math.floor(epochSeconds * 0.4) + 7;
  return {
    gameId: Number(slice.game_id),
    epochSeconds,
    startMainAt,
    nowSeconds,
    currentTick: Math.floor(nowSeconds / Number(slice.tick_config.armies_tick_in_seconds)),
    siteCol: (REALM_TRAIT_ID - 1) * spacing + Math.floor(spacing / 2),
    siteRow: DAY * 4 * spacing + Math.floor(spacing / 2),
  };
};

const requireRow = (rules: WireRow[], model: string) => {
  const row = rules.find((candidate) => candidate.model === model);
  if (!row) throw new Error(`The generated Frontier launch has no ${model}`);
  return row.value;
};

const amount = (whole: number) => (BigInt(whole) * PRECISION).toString();

const playerRows = (clock: LabClock): WireRow[] => [
  { model: "GameRegistry", value: gameRegistry(clock) },
  { model: "Structure", value: realm(clock) },
  {
    model: "ResourceWeight",
    value: { game_id: clock.gameId, entity_id: LAB_REALM_ID, capacity: amount(100_000), weight: "0" },
  },
  { model: "ResourceBalance", value: balance(clock, 38, 150) },
  { model: "ResourceBalance", value: balance(clock, 23, 1_250) },
  { model: "ResourceBalance", value: balance(clock, 35, 640) },
  { model: "ResourceBalance", value: balance(clock, 26, 420) },
  {
    model: "Building",
    value: {
      game_id: clock.gameId,
      structure_id: LAB_REALM_ID,
      inner_col: 10,
      inner_row: 10,
      category: 25,
      paused: false,
      labor_paid: "0",
      tier: "1",
    },
  },
  {
    model: "ResourceProduction",
    value: {
      game_id: clock.gameId,
      entity_id: LAB_REALM_ID,
      resource_type: 23,
      building_count: 1,
      production_rate: String((100n * PRECISION) / 3600n),
      output_amount_left: "0",
      last_updated_at: clock.nowSeconds,
    },
  },
  // Today's ground around the site is explored grassland, so its tiles open their panels.
  ...exploredGround(clock),
  // The realm stands on today's site, with no buildings raised yet beyond the castle.
  {
    model: "TileOccupancy",
    value: {
      game_id: clock.gameId,
      alt: false,
      col: clock.siteCol,
      row: clock.siteRow,
      entity_id: LAB_REALM_ID,
      category: 1,
      is_structure: true,
    },
  },
  {
    model: "StructureBuildings",
    value: {
      game_id: clock.gameId,
      entity_id: LAB_REALM_ID,
      packed_counts_1: "0",
      packed_counts_2: "0",
      packed_counts_3: "0",
      population: { current: 0, max: 6 },
    },
  },
  { model: "RealmKnowledge", value: { game_id: clock.gameId, structure_id: LAB_REALM_ID, learned: 0 } },
  // The realm earned Support III today: its production runs 20% faster until midnight.
  {
    model: "RealmSupport",
    value: {
      game_id: clock.gameId,
      structure_id: LAB_REALM_ID,
      epoch: String(absoluteEpoch(clock, clock.nowSeconds)),
      level: 3,
    },
  },
  { model: "ArmySlot", value: armySlot(clock, 201, 0, 30) },
  { model: "ArmySlot", value: armySlot(clock, 202, 1, 150) },
  // The day's third army fell this morning: its slot keeps the tired bar for the next muster.
  { model: "ArmySlot", value: armySlot(clock, 0, 2, 40) },
  // Army 1 reached level 2 this morning and its pick is still waiting, with more XP banking behind it.
  {
    model: "ArmyProgress",
    value: {
      ...armyProgress(clock, 201),
      level: 2,
      xp: 45,
      battle: 2,
      pending: { id: 1, source: "Level", amount: 1, choices: ["Battle", "Scouting", "Support"] },
    },
  },
  { model: "ArmyProgress", value: armyProgress(clock, 202) },
  { model: "ExplorerTroops", value: army(clock, 201, 1_498, 0) },
  { model: "ExplorerTroops", value: army(clock, 202, 1, 1) },
  { model: "TileOccupancy", value: armyTile(clock, 201, 2, 1) },
  { model: "TileOccupancy", value: armyTile(clock, 202, -3, 2) },
  // A camp beside army 1, held by 1,100 T1 knights, so the tile card has a site to show.
  ...campSite(clock, LAB_CAMP_ID, 3, 1),
  // A Well beside army 1 and a Shrine beside army 2, whose pick is not waiting: single-use sites to use.
  { model: "TileOccupancy", value: mapSiteTile(clock, 811, 1, 1, nativeTileOccupierConstants.WELL_OCCUPIER) },
  { model: "TileOccupancy", value: mapSiteTile(clock, 812, -2, 2, nativeTileOccupierConstants.SHRINE_OCCUPIER) },
];

const LAB_CAMP_ID = 710;

const campSite = (clock: LabClock, entityId: number, colOffset: number, rowOffset: number): WireRow[] => [
  {
    model: "Structure",
    value: {
      ...realm(clock),
      entity_id: entityId,
      owner: "0x0",
      base: { ...realm(clock).base, category: 7, troop_max_guard_count: 1, troop_max_explorer_count: 0 },
    },
  },
  {
    model: "Guard",
    value: {
      game_id: clock.gameId,
      structure_id: entityId,
      slot: 0,
      troops: {
        ...army(clock, 0, 1_100, 0).troops,
        stamina: { Inline: { amount: "0", updated_tick: String(clock.currentTick) } },
      },
      destroyed_tick: 0,
    },
  },
  {
    model: "ExpeditionSite",
    value: {
      game_id: clock.gameId,
      entity_id: entityId,
      kind: "Camp",
      initial_guard_count: amount(1_100),
      cleared: false,
    },
  },
  // Category 37 is a camp's occupancy.
  {
    model: "TileOccupancy",
    value: {
      game_id: clock.gameId,
      alt: false,
      col: clock.siteCol + colOffset,
      row: clock.siteRow + rowOffset,
      entity_id: entityId,
      category: 37,
      is_structure: true,
    },
  },
];

const gameRegistry = (clock: LabClock) => ({
  game_id: clock.gameId,
  name: "0x4c6162",
  preset_id: 5,
  creator: "0x1",
  settled: false,
  ready: true,
  dev_mode_on: false,
  start_settling_at: String(clock.startMainAt - clock.epochSeconds),
  start_main_at: String(clock.startMainAt),
  end_at: String(clock.startMainAt + 30 * clock.epochSeconds),
  end_grace_seconds: 0,
  seed: "0x1",
});

const realm = (clock: LabClock) => ({
  game_id: clock.gameId,
  entity_id: LAB_REALM_ID,
  owner: LAB_PLAYER,
  base: {
    troop_max_guard_count: 0,
    troop_max_explorer_count: 3,
    created_at: clock.startMainAt,
    category: 1,
    level: 0,
    starting_troops_granted: true,
  },
  resources_packed: "0",
  metadata: {
    realm_id: REALM_TRAIT_ID,
    order: 1,
    has_wonder: false,
    village_realm: 0,
    mine_kind: 0,
    deepest_depth: 0,
  },
});

const balance = (clock: LabClock, resourceType: number, whole: number) => ({
  game_id: clock.gameId,
  entity_id: LAB_REALM_ID,
  resource_type: resourceType,
  balance: amount(whole),
});

const army = (clock: LabClock, explorerId: number, count: number, slot: number) => ({
  game_id: clock.gameId,
  explorer_id: explorerId,
  owner: LAB_REALM_ID,
  troops: {
    category: "Knight",
    tier: "T1",
    count: amount(count),
    stamina: { Slot: slot },
    boosts: {
      incr_damage_dealt_percent_num: 0,
      incr_damage_dealt_end_tick: 0,
      decr_damage_gotten_percent_num: 0,
      decr_damage_gotten_end_tick: 0,
      incr_stamina_regen_percent_num: 0,
      incr_stamina_regen_tick_count: 0,
      incr_explore_reward_percent_num: 0,
      incr_explore_reward_end_tick: 0,
    },
    battle_cooldown_end: 0,
  },
});

const armyProgress = (clock: LabClock, explorerId: number) => ({
  game_id: clock.gameId,
  explorer_id: explorerId,
  level: 1,
  xp: 0,
  battle: 1,
  logistics: 1,
  scouting: 1,
  support: 1,
  pending: null,
});

const armySlot = (clock: LabClock, explorerId: number, slot: number, stamina: number) => ({
  game_id: clock.gameId,
  structure_id: LAB_REALM_ID,
  epoch: String(absoluteEpoch(clock, clock.nowSeconds)),
  slot,
  explorer_id: explorerId,
  stamina: { amount: String(stamina), updated_tick: String(clock.currentTick) },
});

const mapSiteTile = (clock: LabClock, entityId: number, colOffset: number, rowOffset: number, category: number) => ({
  game_id: clock.gameId,
  alt: false,
  col: clock.siteCol + colOffset,
  row: clock.siteRow + rowOffset,
  entity_id: entityId,
  category,
  is_structure: false,
});

// Category 15 is a T1 knight explorer's occupancy.
const armyTile = (clock: LabClock, explorerId: number, colOffset: number, rowOffset: number) => ({
  game_id: clock.gameId,
  alt: false,
  col: clock.siteCol + colOffset,
  row: clock.siteRow + rowOffset,
  entity_id: explorerId,
  category: 15,
  is_structure: false,
});

const GRASSLAND = 11;
const BIOME_SCALE = 0x20000000000n;

/** Explored tiles around today's site in TileOpt's packed form: the biome sits above the tile's other bits. */
const exploredGround = (clock: LabClock): WireRow[] =>
  Array.from({ length: 9 }, (_, column) =>
    Array.from({ length: 7 }, (_, row) => ({
      model: "TileOpt",
      value: {
        game_id: clock.gameId,
        alt: false,
        col: clock.siteCol + column - 4,
        row: clock.siteRow + row - 3,
        data: (BigInt(GRASSLAND) * BIOME_SCALE).toString(),
      },
    })),
  ).flat();

/**
 * Herald's Frontier season board for the lab, in the agreed shape: sixty realms, the lab player 57th, so the board
 * shows its top fifty plus the player's own row.
 */
export const labSeasonBoard = (gameId: number) => ({
  game_id: String(gameId),
  mode: "frontier",
  entries: Array.from({ length: 60 }, (_, index) => {
    const total = Math.max(0, 42 - Math.floor(index * 0.7));
    const fallen = Math.floor(total / 8);
    const rifts = Math.floor(total / 4);
    return {
      address: index === 56 ? LAB_PLAYER : `0x${(0xa000 + index).toString(16)}`,
      structure_id: String(index === 56 ? LAB_REALM_ID : 500 + index),
      rank: index + 1,
      sites_cleared: { total, camps: total - rifts - fallen, rifts, fallen_realms: fallen },
      chests_earned: Math.floor(total / 3),
      rewards: {
        lords: String(Math.floor(total / 3) * 400),
        essence: `${total * 3_000}000000000`,
        labor: `${total * 550}000000000`,
      },
      deepest_depth: Math.min(3, Math.floor(total / 12)),
      order: (index % 16) + 1,
    };
  }),
});
