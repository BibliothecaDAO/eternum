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
  releaseId: string;
  schemaHash: string;
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

/** A ranked player with the name they registered in the game, or null before they register one. */
export interface HeraldLeaderboardEntry extends PlayerLeaderboardActivityEntry {
  name: string | null;
}

export interface HeraldLeaderboard {
  game_id: string;
  entries: HeraldLeaderboardEntry[];
}

/** Herald closes a game stream with this code when the game is finalized; the stream will never serve it again. */
export const HERALD_GAME_FINALIZED_CLOSE = 4409;
