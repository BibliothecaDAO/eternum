import type { GameSyncScheduler } from "./scheduler";

export interface GameSyncEntity {
  hashed_keys: string;
  models: Record<string, unknown>;
}

interface GameSyncSnapshotPage {
  items: GameSyncEntity[];
  nextCursor?: string;
}

export interface GameSyncWriter {
  cancel: () => void;
}

export interface GameSyncSubscriptionHandlers {
  onEntity: (entity: GameSyncEntity) => void;
  onEvent: (event: GameSyncEntity) => void;
  onEventGapFill: (replayedEventCount: number) => void;
  onHead?: (head: GameSyncHead) => void;
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
  peakLiveUpdatesPerSecond: number;
  snapshotEntityCount: number;
  snapshotPageCount: number;
  totalLiveEntityUpdates: number;
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
  onMetrics?: (metrics: GameSyncRuntimeMetrics) => void;
  onHead?: (head: GameSyncHead) => void;
  onTransaction?: (transaction: GameSyncTransaction) => void;
}
