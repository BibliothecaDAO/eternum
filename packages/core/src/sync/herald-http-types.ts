import type { AspectId } from "@bibliothecadao/types";

export type HeraldGameStatus = "Created" | "Registration" | "Live" | "Ended" | "Settled";

export interface HeraldGameClock {
  scheduled_end_at: number;
  end_at: number;

  start_main_at: number;
  start_settling_at: number;
}

export interface HeraldGameRegistration {
  count: number;
  max: number;
  start_at: number;
}

export interface HeraldGameSettlementConfig {
  base_distance: number;
  layer_max: number;
  layers_skipped: number;
  map_center_offset: number;
  single_realm_mode: boolean;
  spires_layer_distance: number;
  spires_max_count: number;
  spires_settled_count: number;
}

/** One structure the requesting player owns in the game. */
export interface HeraldPlayerStructure {
  entity_id: number;
  category: number;
  /** Structure progression level; the original model is tier I. */
  level: number;
  realm_id: number;
  coord_x: number | null;
  coord_y: number | null;
  resources_packed: string;
}

export interface HeraldPlayerQuest {
  quest_id: number;
  progress: number;
  target: number;
  labor: number;
}

export interface HeraldAspectRace {
  finish_height: number;
  season_days: number;
  heights: Record<AspectId, number>;
}

/** The requesting player's standing in one game: everything the entry screens read before the player joins. */
export interface HeraldPlayerGameState {
  registered: boolean;
  settled: boolean;
  held_realm_id: number | null;
  has_home_source: boolean;
  taken_realm_ids: number[];
  structures: HeraldPlayerStructure[];
  today_quest?: HeraldPlayerQuest | null;
  fragments: number | null;
  ancient_seal: boolean;
}

export interface HeraldGameDirectoryEntry {
  clock: HeraldGameClock;
  clock_scale: number;
  dev_mode_on: boolean;
  /** A game with days: its day unit and the seed its bags of days are drawn from (decimal). */
  expedition: { day_unit_seconds: number; seed: string } | null;
  /** Unknown on older Heralds; null outside a current Frontier day. Index is zero-based; times/durations are seconds. */
  day_index?: number | null;
  day_ends_at?: number | null;
  next_day_length?: number | null;
  /** One-based Frontier registry ordinal on this world, retained across finalization. */
  season_number?: number | null;
  game_id: number;
  mode: "blitz" | "eternum" | "frontier";
  name: string;
  player_count: number;
  /** Homes per Aspect; null without Aspects, absent on archived directory responses. */
  aspect_members?: Record<AspectId, number> | null;
  aspect_race?: HeraldAspectRace | null;
  quest_bonus_percent?: number | null;
  player_state: HeraldPlayerGameState | null;
  registration: HeraldGameRegistration | null;
  settled_realms_count: number;
  settled_villages_count: number;
  settlement: HeraldGameSettlementConfig | null;
  /** Effective phase at Herald's chain clock; Settled requires recorded settlement. */
  status: HeraldGameStatus;
}

export type NativeReleases = Readonly<Record<string, { schema: string; family: number; previous: number }>>;

/** GET /manifest: everything a client needs to open a shard beyond the shard's own URL. */
export interface ShardManifest {
  version: 1;
  chainId: string;
  releases: NativeReleases;
  rpcUrl: string;
  accountClassHash: string;
  contracts: Record<string, string>;
  /** The key that authorizes device keys on this shard's Realms accounts. */
  guardianPublicKey: string;
  /** The exact l2 gas max_amount every play carries (a canonical hex u64); the shard refuses any other bounds. */
  l2GasBound: string;
}

export interface HeraldGameDirectory {
  chain: string;
  world_address?: string;
  confirmed_block: number;
  games: HeraldGameDirectoryEntry[];
}

interface HeraldSnapshotRow {
  key: string;
  value: Record<string, unknown>;
}

export interface HeraldSnapshotModel {
  model: string;
  rows: HeraldSnapshotRow[];
}

export interface HeraldGameSnapshot {
  confirmed_block: number;
  game_id: string;
  models: HeraldSnapshotModel[];
}

export interface HeraldHistoryEvent {
  block_number: number;
  event_index: number;
  game_id: string;
  model: string;
  transaction_hash: string;
  transaction_index: number;
  value: Record<string, unknown>;
}

export interface HeraldHistoryPage {
  complete_through_block: number | null;
  items: HeraldHistoryEvent[];
  limit: number;
  offset: number;
  total: number;
}

export interface HeraldFrontierLeaderboardEntry {
  /** Native founding trait; absent only in historical boards recorded before home identity was included. */
  has_wonder?: boolean;
  address: string;
  structure_id: string;
  /** Immutable founding identity from the complete game; null explicitly identifies an ordinary home. */
  rank: number;
  sites_cleared: { total: number; camps: number; rifts: number; ruins: number; beasts: number };
  chests_earned: number;
  rewards: { lords: string; essence: string; labor: string };
  /** The deepest Ethereal reach the realm has gone to (0 before the first): its badge on the board. */
  deepest_depth: number;
  /** The realm's level (0 a Settlement up to its castle's highest): its rank's castle on the board. */
  level: number;
  /** The realm's Order, 1 to 16: its emblem on the board. */
  order: number;
}

export interface HeraldFrontierLeaderboard {
  game_id: string;
  mode: "frontier";
  entries: HeraldFrontierLeaderboardEntry[];
  prize: HeraldFrontierPrize | null;
}

export interface HeraldFrontierPrize {
  pool: string;
  top_n: number;
  count: number | null;
  /** The places paid so far, by rank: who the ledger paid and its whole LORDS. A fixed place awaiting its award has none. */
  awards: HeraldFrontierAward[];
}

export interface HeraldFrontierAward {
  rank: number;
  address: string;
  lords: string;
}

export interface HeraldGameStats {
  game_id: string;
  players: number;
  realms: number;
  transactions: HeraldGameTransactions;
}

export interface HeraldGameTransactions {
  total: number;
  days: { day: string; transactions: number }[];
}

export interface HeraldAspectRoster {
  game_id: string;
  aspect: number;
  total: number;
  offset: number;
  limit: number;
  members: HeraldAspectRosterMember[];
}

export interface HeraldAspectRosterMember {
  rank: number;
  entity_id: string;
  realm_id: number;
  owner: string;
  glory: string;
}

/** Immutable ranks at a seeded day's end; confirmed_block is the last block strictly before that instant. */
export interface HeraldFrontierDayRanks {
  game_id: string;
  day_index: number;
  ends_at: number;
  confirmed_block: number;
  entries: { address: string; structure_id: string; rank: number }[];
}

/** Herald closes a game stream with this code when the game is finalized; the stream will never serve it again. */
export const HERALD_GAME_FINALIZED_CLOSE = 4409;

/** Herald answered, with a failure status. A client error other than a timeout or a rate limit will not change on retry. */
export class HeraldHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "HeraldHttpError";
  }

  get permanent(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 408 && this.status !== 429;
  }
}
