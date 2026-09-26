import type { PlayerLeaderboardActivityEntry } from "./leaderboard-activity";

export type HeraldGameStatus = "Created" | "Registration" | "Live" | "Ended" | "Settled";

export interface HeraldGameClock {
  end_at: number;
  end_grace_seconds: number;

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
  two_player_mode: boolean;
}

/** One structure the requesting player owns in the game. */
export interface HeraldPlayerStructure {
  entity_id: number;
  category: number;
  /** Structure progression level; the original model is tier I. */
  level: number;
  realm_id: number;
  coord_x: number;
  coord_y: number;
  resources_packed: string;
}

/** The requesting player's standing in one game: everything the entry screens read before the player joins. */
export interface HeraldPlayerGameState {
  registered: boolean;
  settled: boolean;
  roster_member: boolean;
  structures: HeraldPlayerStructure[];
}

export interface HeraldGameDirectoryEntry {
  ready: boolean;
  clock: HeraldGameClock;
  dev_mode_on: boolean;
  expedition: { epoch_seconds: number } | null;
  game_id: number;
  mode: "blitz" | "eternum" | "frontier" | "duel" | null;
  name: string;
  player_count: number;
  player_state: HeraldPlayerGameState | null;
  /** Players on a Blitz game's fixed roster; 0 for open-entry games. */
  roster_count: number;
  preset_id: number;
  registration: HeraldGameRegistration | null;
  settled_realms_count: number;
  settled_villages_count: number;
  settlement: HeraldGameSettlementConfig | null;
  /** Effective phase at Herald's chain clock; Settled requires recorded settlement. */
  status: HeraldGameStatus;
}

/** GET /manifest: everything a client needs to open a shard beyond the shard's own URL. */
export interface ShardManifest {
  version: 1;
  chainId: string;
  releaseSchemas: Record<string, string>;
  rpcUrl: string;
  admissionUrl: string;
  accountClassHash: string;
  contracts: Record<string, string>;
  /** The key that authorizes device keys on this shard's Realms accounts. */
  guardianPublicKey: string;
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

export interface HeraldTransactionCount {
  count: number;
  game_id: string;
}

/** A ranked player by address; their name is their identity profile, which the client resolves. */
export type HeraldLeaderboardEntry = PlayerLeaderboardActivityEntry;

export interface HeraldLeaderboard {
  mode: "points";
  game_id: string;
  entries: HeraldLeaderboardEntry[];
}

export interface HeraldFrontierLeaderboardEntry {
  address: string;
  structure_id: string;
  rank: number;
  sites_cleared: { total: number; camps: number; rifts: number; fallen_realms: number };
  chests_earned: number;
  rewards: { lords: string; essence: string; labor: string };
  deepest_depth: number;
  /** The realm's Order, 1 to 16: its emblem on the board. */
  order: number;
}

export interface HeraldFrontierLeaderboard {
  game_id: string;
  mode: "frontier";
  entries: HeraldFrontierLeaderboardEntry[];
}

export type HeraldGameLeaderboard = HeraldLeaderboard | HeraldFrontierLeaderboard;

/** Herald closes a game stream with this code when the game is finalized; the stream will never serve it again. */
export const HERALD_GAME_FINALIZED_CLOSE = 4409;
