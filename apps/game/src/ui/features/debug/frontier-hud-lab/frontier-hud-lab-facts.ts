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
  { model: "ExplorerTroops", value: army(clock, 201, 1_498, 30, 0) },
  { model: "ExplorerTroops", value: army(clock, 202, 1, 150, 0) },
  { model: "TileOccupancy", value: armyTile(clock, 201, 2, 1) },
  { model: "TileOccupancy", value: armyTile(clock, 202, -3, 2) },
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
    attunement: 0,
    barracks_tier: 0,
  },
});

const balance = (clock: LabClock, resourceType: number, whole: number) => ({
  game_id: clock.gameId,
  entity_id: LAB_REALM_ID,
  resource_type: resourceType,
  balance: amount(whole),
});

const army = (clock: LabClock, explorerId: number, count: number, stamina: number, ticksAgo: number) => ({
  game_id: clock.gameId,
  explorer_id: explorerId,
  owner: LAB_REALM_ID,
  troops: {
    category: "Knight",
    tier: "T1",
    count: amount(count),
    stamina: { amount: String(stamina), updated_tick: String(clock.currentTick - ticksAgo) },
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
