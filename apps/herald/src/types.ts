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
  block_number: number | null;
  transaction_hash: Felt;
  transaction_index: number;
  event_index: number;
  keys: Felt[];
  data: Felt[];
}

export interface RpcEvent {
  from_address: Felt;
  keys: Felt[];
  data: Felt[];
}

export interface RpcReceipt {
  block_number?: number | null;
  transaction_hash: Felt;
  finality_status: string;
  execution_status?: string;
  revert_reason?: string;
  events: RpcEvent[];
}

export interface RpcTransaction {
  transaction_hash?: Felt;
  sender_address?: Felt;
  contract_address?: Felt;
  type: string;
}

export interface RpcSubscribedTransaction extends Partial<RpcTransaction> {
  finality_status: string;
  transaction?: RpcTransaction;
}

export interface RpcBlockTransaction {
  receipt: RpcReceipt;
  transaction: RpcTransaction;
}

export interface RpcBlockWithReceipts {
  block_number: number;
  timestamp: number;
  transactions: RpcBlockTransaction[];
}

export interface RpcHead {
  block_number: number;
  timestamp: number;
}

export interface RpcSubscribedEvent extends RpcEvent {
  block_number: number | null;
  transaction_hash: Felt;
  transaction_index: number;
  event_index: number;
  finality_status: string;
}

export interface EventPosition {
  blockNumber: number | null;
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

export interface FoldCheckpointRow {
  entity_id: Felt;
  key: DecodedRecord;
  value: DecodedRecord;
}

export interface FoldCheckpointModel {
  model: string;
  rows: FoldCheckpointRow[];
}

export interface FoldCheckpoint {
  version: 1;
  world_address: Felt;
  models: FoldCheckpointModel[];
}

export interface FoldSet {
  model: string;
  key: Felt;
  value: DecodedRecord;
}

export interface FoldDelete {
  model: string;
  key: Felt;
}

export interface FoldChange {
  gameId?: string;
  set?: FoldSet;
  del?: FoldDelete;
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
