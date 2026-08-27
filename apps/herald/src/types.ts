import type { GameSyncModelDefinition } from "@bibliothecadao/eternum/game-sync-models";

export type Felt = string;

export interface ManifestMember {
  name: string;
  type: string;
  key: boolean;
}

export interface ManifestModel {
  tag: string;
  selector: Felt;
  members: ManifestMember[];
}

export interface StructAbiEntry {
  type: "struct";
  name: string;
  members: Array<{ name: string; type: string }>;
}

export interface EnumAbiEntry {
  type: "enum";
  name: string;
  variants: Array<{ name: string; type: string }>;
}

export type ManifestAbiEntry = StructAbiEntry | EnumAbiEntry | Record<string, unknown>;

export interface WorldManifest {
  world: { address: Felt };
  models: ManifestModel[];
  events: ManifestModel[];
  abis: ManifestAbiEntry[];
}

export interface RawWorldEvent {
  block_number: number;
  transaction_hash: Felt;
  transaction_index: number;
  event_index: number;
  keys: Felt[];
  data: Felt[];
}

export interface EventPosition {
  blockNumber: number;
  transactionHash: Felt;
  transactionIndex: number;
  eventIndex: number;
}

export interface DecodedRecord {
  [field: string]: unknown;
}

interface DecodedWorldEventBase {
  model: GameSyncModelDefinition;
  entityId: Felt;
  position: EventPosition;
}

export type DecodedWorldEvent =
  | (DecodedWorldEventBase & { kind: "set"; key: DecodedRecord; value: DecodedRecord })
  | (DecodedWorldEventBase & { kind: "update"; value: DecodedRecord })
  | (DecodedWorldEventBase & { kind: "update-member"; member: string; value: unknown })
  | (DecodedWorldEventBase & { kind: "delete" })
  | (DecodedWorldEventBase & { kind: "event"; key: DecodedRecord; value: DecodedRecord });

export interface FoldRow {
  key: Felt;
  value: DecodedRecord;
}

export interface SnapshotModel {
  model: string;
  rows: FoldRow[];
}

export interface GameSnapshot {
  game_id: string;
  confirmed_block: number;
  models: SnapshotModel[];
}

export interface ReplayMetrics {
  decoded_events: number;
  retained_rows: number;
  store_events: number;
  event_messages: number;
  pages: number;
}

export interface BuiltGameSnapshot {
  snapshot: GameSnapshot;
  metrics: ReplayMetrics;
}
