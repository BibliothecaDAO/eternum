export type HeraldGameStatus = "Created" | "Registration" | "Live" | "Ended" | "Settled";

export interface HeraldGameClock {
  end_at: number;
  end_grace_seconds: number;
  registration_grace_seconds: number;
  start_main_at: number;
  start_settling_at: number;
}

export interface HeraldGameRegistration {
  count: number;
  fee_amount: string;
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

export interface HeraldGameDirectoryEntry {
  clock: HeraldGameClock;
  dev_mode_on: boolean;
  game_id: number;
  mode: "blitz" | "eternum" | null;
  name: string;
  player_count: number;
  preset_id: number;
  registration: HeraldGameRegistration | null;
  settled_realms_count: number;
  settled_villages_count: number;
  settlement: HeraldGameSettlementConfig | null;
  status: HeraldGameStatus;
}

export interface HeraldChainDirectoryConfig {
  entry_token_address: string | null;
  fee_token_address: string | null;
  mmr_enabled: boolean;
}

export interface HeraldGameDirectory {
  chain: string;
  chain_config: HeraldChainDirectoryConfig | null;
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
