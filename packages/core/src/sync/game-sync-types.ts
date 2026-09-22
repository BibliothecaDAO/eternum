import type { NativeExecutionOutcome } from "@bibliothecadao/types";
import type { GameSyncScheduler } from "./scheduler";

/** One Herald fact: a model row named by its Herald key. A null value removes the row. */
export interface GameSyncFact {
  model: string;
  key: string;
  value: Record<string, unknown> | null;
}

/** An ephemeral Herald row: it drives flourishes such as toasts, never current state. */
export interface GameSyncEvent {
  model: string;
  key: string;
  value: Record<string, unknown>;
}

/** The facts of one Herald diff. One player action becomes visible in one store write. */
export interface GameSyncFactBatch {
  facts: GameSyncFact[];
  preconfirmed: boolean;
  transactionHash?: string;
}

/** The only keys a replacement keeps for each listed model; every other stored row of those models is removed. */
export type GameSyncRetainedKeys = ReadonlyMap<string, ReadonlySet<string>>;

export interface GameSyncEventConfirmation {
  block: number | null;
  preconfirmed: boolean;
  /** True only for confirmations newer than this socket's advertised head. Disconnect catch-up is excluded. */
  confirmedAfterAttach?: boolean;
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

export interface GameSyncWriter {
  cancel: () => void;
}

export interface GameSyncSubscriptionHandlers {
  /** A snapshot replaces every row of every model it lists; its models follow until onSnapshotEnd. */
  onSnapshotStart: () => void;
  onSnapshotModel: (model: string, facts: GameSyncFact[], progress: GameSyncSnapshotChunkProgress) => void;
  onSnapshotEnd: () => void;
  /** Selecting an actor replaces the rows of the actor-scoped models. */
  onScope: (facts: GameSyncFact[], expedition: boolean) => void;
  onFacts: (batch: GameSyncFactBatch) => void;
  onEvent: (event: GameSyncEvent, confirmation: GameSyncEventConfirmation) => void;
  onHead: (head: GameSyncHead) => void;
  onTransaction: (transaction: GameSyncTransaction) => void;
  /** The stream failed before its first snapshot ended, so the session cannot start. */
  onStartFailure: (error: Error) => void;
}

export interface GameSyncTransport {
  /** Resolves once the stream is attached; the snapshot and the ordered diffs follow through the handlers. */
  subscribe: (handlers: GameSyncSubscriptionHandlers) => Promise<GameSyncWriter>;
  transactionStatusChannel?: true;
  /**
   * Tears the transport down, failing a subscribe or snapshot page still in flight. A resolved subscribe is
   * cancelled through its writer; only a transport that never became active needs this.
   */
  dispose?: () => void;
}

export interface GameSyncHead {
  block: number;
  /** The sequencer clock read off the pre-confirmed block, not a confirmed block. */
  preconfirmed: boolean;
  timestamp: number;
}

export interface GameSyncTransaction {
  executions?: NativeExecutionOutcome[];
  block: number | null;
  hash: string;
  revertReason?: string;
  status: string;
}

export interface GameSyncStore {
  applyFacts: (facts: readonly GameSyncFact[], retain?: GameSyncRetainedKeys) => Promise<void> | void;
  applyEvent: (event: GameSyncEvent) => Promise<void> | void;
}

export interface GameSyncRuntimeMetrics {
  appliedBatchCount: number;
  lastRecoveryDurationMs: number;
  maxBatchApplyDurationMs: number;
  /** Same as maxBatchApplyDurationMs over running-status slices only: neither the snapshot nor the boot replay hides the churn number. */
  maxLiveBatchApplyDurationMs: number;
  peakLiveUpdatesPerSecond: number;
  /** Spatial projection publishes; against appliedBatchCount it is the L4 gate (at most one per slice). */
  projectionPublishCount: number;
  snapshotEntityCount: number;
  snapshotPageCount: number;
  /** Store apply time spent while snapshotting: the boot's write cost, separate from the receive wait. */
  snapshotApplyDurationMs: number;
  totalLiveEntityUpdates: number;
  /** Component writes the store performed for live rows (replay + running); with totalLiveEntityUpdates it is the L1 amplification ratio. */
  totalLiveEntityOperationsApplied: number;
  totalLiveEventUpdates: number;
}

export interface GameSyncSessionStart {
  onDispose?: () => void;
  transport: GameSyncTransport;
  store: GameSyncStore;
  snapshotModels: readonly string[];
  scheduler?: GameSyncScheduler;
  eventIdentityLimit?: number;
  now?: () => number;
  onSubscriptionActive?: () => void;
  onLiveUpdate?: (kind: "entity" | "event") => void;
  onError?: (error: Error) => void;
  onEvent?: (event: GameSyncEvent, confirmation: GameSyncEventConfirmation) => void;
  onMetrics?: (metrics: GameSyncRuntimeMetrics) => void;
  onSnapshotProgress?: (progress: GameSyncSnapshotProgress) => void;
  onHead?: (head: GameSyncHead) => void;
  onTransactionEntitiesApplied?: (transactionHash: string) => void;
  onTransactionEntitiesReceived?: (transactionHash: string) => void;
  onTransaction?: (transaction: GameSyncTransaction) => void;
}
