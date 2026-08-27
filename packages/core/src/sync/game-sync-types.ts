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

export type GameSyncAuthoritativeObservation =
  | { type: "model"; entityId: string; model: string; value: Record<string, unknown> | null }
  | { type: "delete-entity"; entityId: string };

export interface GameSyncProvisionalWrite {
  entityId: string;
  model: string;
  /** Optional optimistic overlay. Evidence-only writes omit it. */
  patch?: Record<string, unknown> | null;
  /** Deterministic authoritative subset that settles this write. Undefined means overlay-only. */
  matchPatch?: Record<string, unknown> | null;
  /** Optional legitimate no-op outcome, held briefly to distinguish it from a stale echo. */
  sourcePatch?: Record<string, unknown>;
  /** Top-level authoritative fields that settle once any differs from the creation-time base value. */
  baselineDeltaFields?: readonly string[];
}

export interface GameSyncProvisionalIntentStalledInfo {
  intentId: string;
  transactionHash?: string;
  unmatchedWrites: Array<{
    entityId: string;
    model: string;
    matchPatch?: Record<string, unknown> | null;
    sourcePatch?: Record<string, unknown>;
    baselineDeltaFields?: readonly string[];
  }>;
}

export interface GameSyncProvisionalIntentPhaseInfo {
  phase: "created" | "transaction_hash" | "authoritative_echo" | "baseline_delta_before_hash";
  intentId: string;
  transactionHash?: string;
  model?: string;
  elapsedSinceCreatedMs: number;
  elapsedSinceTransactionHashMs?: number;
}

export interface GameSyncStore {
  applyEntityOperations: (
    operations: readonly GameSyncEntityStoreOperation[],
  ) => Promise<readonly GameSyncAuthoritativeObservation[] | void> | readonly GameSyncAuthoritativeObservation[] | void;
  applyEvent: (event: GameSyncEntity) => Promise<void> | void;
  listModelEntityIds: (model: string) => Iterable<string>;
  readAuthoritativeModel?: (model: string, entityId: string) => Record<string, unknown> | null | undefined;
  applyProvisionalWrites?: (intentId: string, writes: readonly GameSyncProvisionalWrite[]) => void;
  removeProvisionalWrites?: (intentId: string) => void;
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
  onProvisionalIntentStalled?: (info: GameSyncProvisionalIntentStalledInfo) => void;
  onProvisionalIntentPhase?: (info: GameSyncProvisionalIntentPhaseInfo) => void;
}
