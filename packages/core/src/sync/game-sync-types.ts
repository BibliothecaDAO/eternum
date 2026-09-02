import type { GameSyncScheduler } from "./scheduler";

export interface GameSyncEntity {
  hashed_keys: string;
  models: Record<string, unknown>;
}

export interface GameSyncEntityBatch {
  entities: GameSyncEntity[];
  preconfirmed: boolean;
  transactionHash?: string;
}

export interface GameSyncSnapshotChunkProgress {
  bytesReceived: number;
  model: string;
  modelsReceived: number;
  rowsReceived: number;
}

export interface GameSyncSnapshotProgress {
  completed: number;
  phase: "receiving" | "applying";
  /** True while more snapshot pages may still arrive, so `completed >= total` is not yet the end of the phase. */
  streaming: boolean;
  total: number;
}

export interface GameSyncSnapshotPage {
  items: GameSyncEntity[];
  nextCursor?: string;
}

export interface GameSyncWriter {
  cancel: () => void;
}

export interface GameSyncSubscriptionHandlers {
  onEntity: (entity: GameSyncEntity) => void;
  onEntityBatch?: (batch: GameSyncEntityBatch) => void;
  onEvent: (event: GameSyncEntity) => void;
  onEventGapFill: (replayedEventCount: number) => void;
  onHead?: (head: GameSyncHead) => void;
  onSnapshotChunk?: (progress: GameSyncSnapshotChunkProgress) => void;
  onTransaction?: (transaction: GameSyncTransaction) => void;
}

export interface GameSyncTransport {
  /** Resolves only after both entity and event subscriptions are active. */
  subscribe: (handlers: GameSyncSubscriptionHandlers) => Promise<GameSyncWriter>;
  fetchSnapshotPage: (cursor?: string) => Promise<GameSyncSnapshotPage>;
  transactionStatusChannel?: true;
}

export interface GameSyncHead {
  block: number;
  timestamp: number;
}

export interface GameSyncTransaction {
  block: number | null;
  hash: string;
  revertReason?: string;
  status: string;
}

export type GameSyncEntityStoreOperation =
  | { type: "upsert"; entities: GameSyncEntity[] }
  | { type: "remove-components"; entityId: string; models: string[] }
  | { type: "delete-entity"; entityId: string };

export interface GameSyncStore {
  applyEntityOperations: (operations: readonly GameSyncEntityStoreOperation[]) => Promise<void> | void;
  applyEvent: (event: GameSyncEntity) => Promise<void> | void;
  listModelEntityIds: (model: string) => Iterable<string>;
}

export interface GameSyncRuntimeMetrics {
  appliedBatchCount: number;
  eventGapFillReplayCount: number;
  lastRecoveryDurationMs: number;
  maxBatchApplyDurationMs: number;
  /** Same as maxBatchApplyDurationMs over running-status slices only: neither the snapshot nor the boot replay hides the churn number. */
  maxLiveBatchApplyDurationMs: number;
  peakLiveUpdatesPerSecond: number;
  /** Spatial projection publishes; against appliedBatchCount it is the L4 gate (at most one per slice). */
  projectionPublishCount: number;
  snapshotEntityCount: number;
  snapshotPageCount: number;
  totalLiveEntityUpdates: number;
  /** Component writes the store performed for live rows (replay + running); with totalLiveEntityUpdates it is the L1 amplification ratio. */
  totalLiveEntityOperationsApplied: number;
  totalLiveEventUpdates: number;
  totalReplayedEventUpdates: number;
}

export interface GameSyncSessionStart {
  transport: GameSyncTransport;
  store: GameSyncStore;
  snapshotModels: readonly string[];
  scheduler?: GameSyncScheduler;
  eventIdentityLimit?: number;
  now?: () => number;
  onSubscriptionActive?: () => void;
  onLiveUpdate?: (kind: "entity" | "event") => void;
  onError?: (error: Error) => void;
  onEvent?: (event: GameSyncEntity) => void;
  onMetrics?: (metrics: GameSyncRuntimeMetrics) => void;
  onSnapshotProgress?: (progress: GameSyncSnapshotProgress) => void;
  onHead?: (head: GameSyncHead) => void;
  onTransactionEntitiesApplied?: (transactionHash: string) => void;
  onTransactionEntitiesReceived?: (transactionHash: string) => void;
  onTransaction?: (transaction: GameSyncTransaction) => void;
}
