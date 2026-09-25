import { FactIngestQueue, type FactIngestBatchInfo } from "./fact-ingest-queue";
import type {
  GameSyncEvent,
  GameSyncEventConfirmation,
  GameSyncFact,
  GameSyncRuntimeMetrics,
  GameSyncSnapshotChunkProgress,
  GameSyncSessionStart,
  GameSyncSubscriptionHandlers,
  GameSyncTransaction,
  GameSyncWriter,
} from "./game-sync-types";
import { isScopedGameSyncModel } from "./model-manifest";
import { createMicrotaskGameSyncScheduler } from "./scheduler";
import type { WorldSpatialProjection } from "./world-spatial-projection";
import { eventConfirmationRank } from "./event-confirmation";

export type GameSyncRuntimeStatus = "idle" | "subscribing" | "snapshotting" | "replaying" | "running" | "stopped";

export class SupersededGameSyncStartError extends Error {
  constructor() {
    super("Game sync start was superseded by a newer session");
    this.name = "SupersededGameSyncStartError";
  }
}

/** A snapshot being received: the keys it lists per model, and its facts while they are held for one write. */
interface SnapshotAssembly {
  retained: Map<string, Set<string>>;
  held: GameSyncFact[] | null;
}

const DEFAULT_EVENT_IDENTITY_LIMIT = 512;
const DEFAULT_TRANSACTION_STATUS_LIMIT = 512;
// The first snapshot is bulk work spread over frames in pieces of this size; nothing renders it until it ends.
const SNAPSHOT_PIECE_FACTS = 1_000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const resolveEventTimestamp = (model: string, value: unknown): string => {
  if (!isRecord(value) || !("timestamp" in value)) {
    throw new Error(`Game sync event ${model} is missing its timestamp`);
  }

  const timestamp = value.timestamp;
  if (!["bigint", "number", "string"].includes(typeof timestamp)) {
    throw new Error(`Game sync event ${model} has an invalid timestamp`);
  }

  return String(timestamp);
};

const eventIdentity = ({ model, key, value }: GameSyncEvent): string => {
  if (isRecord(value) && "event_position" in value) {
    const position = value.event_position;
    if (
      !isRecord(position) ||
      typeof position.transaction_hash !== "string" ||
      !/^0x[0-9a-f]+$/i.test(position.transaction_hash) ||
      !Number.isSafeInteger(position.event_index) ||
      Number(position.event_index) < 0
    ) {
      throw new Error(`Game sync event ${model} has an invalid event position`);
    }
    return `${model}:${BigInt(position.transaction_hash)}:${position.event_index}`;
  }
  // Historical story keys already identify the event; confirmation may correct its timestamp.
  if (model === "StoryEvent" || model.endsWith("-StoryEvent")) return `${model}:${key}`;
  return `${model}:${key}:${resolveEventTimestamp(model, value)}`;
};

const createEmptyMetrics = (): GameSyncRuntimeMetrics => ({
  appliedBatchCount: 0,
  lastRecoveryDurationMs: 0,
  maxBatchApplyDurationMs: 0,
  maxLiveBatchApplyDurationMs: 0,
  peakLiveUpdatesPerSecond: 0,
  projectionPublishCount: 0,
  snapshotEntityCount: 0,
  snapshotPageCount: 0,
  snapshotApplyDurationMs: 0,
  totalLiveEntityUpdates: 0,
  totalLiveEntityOperationsApplied: 0,
  totalLiveEventUpdates: 0,
});

/** Owns the session-scoped stream, snapshot hydration, and ordered native store writes. */
export class GameSyncRuntime {
  private generation = 0;
  private writer: GameSyncWriter | null = null;
  private status: GameSyncRuntimeStatus = "idle";
  private session: GameSyncSessionStart | null = null;
  /** Settles on the session's first confirmed head: chain time is unknown before it, so nothing reads the clock. */
  private confirmedHead: Deferred = createDeferred();
  private ingestQueue: FactIngestQueue | null = null;
  /** The running start's wait for its first snapshot; a newer session or dispose ends it. */
  private firstSnapshot: Deferred | null = null;
  private worldSpatialProjection: WorldSpatialProjection | null = null;
  private recentEventIdentities = new Map<string, number>();
  private liveUpdateSamples: Array<{ at: number; count: number }> = [];
  private metrics = createEmptyMetrics();
  private recentTransactions = new Map<string, GameSyncTransaction>();
  private localTransactions = new Map<string, true>();
  private snapshotAppliedOperations = 0;
  private snapshotExpectedOperations = 0;
  private snapshotStreaming = false;
  private readonly sliceAppliedListeners = new Set<() => void>();
  private readonly resyncListeners = new Set<() => void>();
  private transactionWaiters = new Map<
    string,
    Array<{ reject: (error: Error) => void; resolve: (transaction: GameSyncTransaction) => void }>
  >();

  public getStatus(): GameSyncRuntimeStatus {
    return this.status;
  }

  public getMetrics(): GameSyncRuntimeMetrics {
    return { ...this.metrics };
  }

  public isStarting(): boolean {
    return ["subscribing", "snapshotting", "replaying"].includes(this.status);
  }

  public hasTransactionStatusChannel(): boolean {
    return this.session?.transport.transactionStatusChannel === true;
  }

  public waitForTransaction(transactionHash: string): Promise<GameSyncTransaction> {
    if (!this.hasTransactionStatusChannel()) {
      return Promise.reject(new Error("The active game sync session has no transaction status channel"));
    }
    const identity = normalizeTransactionHash(transactionHash);
    const known = this.recentTransactions.get(identity);
    if (known) return settleTransaction(known);

    return new Promise<GameSyncTransaction>((resolve, reject) => {
      const waiters = this.transactionWaiters.get(identity) ?? [];
      waiters.push({ reject, resolve });
      this.transactionWaiters.set(identity, waiters);
    });
  }

  public recordSubmittedTransaction(transactionHash: string): void {
    const identity = normalizeTransactionHash(transactionHash);
    this.localTransactions.delete(identity);
    this.localTransactions.set(identity, true);
    while (this.localTransactions.size > DEFAULT_TRANSACTION_STATUS_LIMIT) {
      const oldest = this.localTransactions.keys().next().value;
      if (oldest === undefined) break;
      this.localTransactions.delete(oldest);
    }
  }

  public async startSession(input: GameSyncSessionStart): Promise<void> {
    this.disposeWorldSpatialProjection();
    this.session = input;
    this.confirmedHead.reject(new Error("Game sync session was replaced"));
    this.confirmedHead = createDeferred();
    this.recentEventIdentities.clear();
    this.rejectTransactionWaiters("Game sync session was replaced");
    this.recentTransactions.clear();
    this.localTransactions.clear();
    this.liveUpdateSamples = [];
    this.snapshotAppliedOperations = 0;
    this.snapshotExpectedOperations = 0;
    this.metrics = createEmptyMetrics();
    await this.runRecovery();
  }

  public async recover(): Promise<void> {
    if (!this.session) throw new Error("GameSyncRuntime has no session to recover");
    await this.runRecovery();
  }

  /** UI cleanup cannot interrupt an in-flight recovery; dispose() always can. */
  public cancelGlobalWriter(): void {
    if (this.isStarting()) return;
    this.cancelWriterImmediately();
  }

  /** Resolves once the session has a confirmed head, the moment chain time becomes known. */
  public waitForConfirmedHead(): Promise<void> {
    return this.confirmedHead.promise;
  }

  public installWorldSpatialProjection(projection: WorldSpatialProjection): void {
    this.disposeWorldSpatialProjection();
    try {
      projection.subscribe(() => {
        this.metrics.projectionPublishCount += 1;
      });
      projection.start();
      this.worldSpatialProjection = projection;
    } catch (error) {
      projection.dispose();
      throw error;
    }
  }

  public requireWorldSpatialProjection(): WorldSpatialProjection {
    if (!this.worldSpatialProjection) {
      throw new Error("WorldSpatialProjection has not been installed for the active game");
    }
    return this.worldSpatialProjection;
  }

  public getWorldSpatialProjection(): WorldSpatialProjection | null {
    return this.worldSpatialProjection;
  }

  /**
   * Fires once per applied ingest slice, after the spatial projection flushed. Store bridges derive from native store here,
   * so a slice that touched a thousand rows costs the overlay one recompute, not a thousand.
   */
  public subscribeSliceApplied(listener: () => void): () => void {
    this.sliceAppliedListeners.add(listener);
    return () => this.sliceAppliedListeners.delete(listener);
  }

  /**
   * Fires once a reconnect's fresh snapshot has replaced the store. Herald streams a transaction's status only once, so
   * a status it sent before the reconnect, or a transaction it recorded while it was down, will never arrive; waits for
   * one must settle from the store after this.
   */
  public subscribeResynced(listener: () => void): () => void {
    this.resyncListeners.add(listener);
    return () => this.resyncListeners.delete(listener);
  }

  public dispose(): void {
    this.generation += 1;
    this.abandonFirstSnapshot();
    this.cancelWriterImmediately();
    // A subscribe that never resolved has no writer to cancel; only the transport can stop its reconnects.
    this.session?.transport.dispose?.();
    this.session?.onDispose?.();
    this.sliceAppliedListeners.clear();
    this.resyncListeners.clear();
    this.disposeWorldSpatialProjection();
    this.ingestQueue?.dispose();
    this.ingestQueue = null;
    this.session = null;
    this.rejectTransactionWaiters("Game sync runtime stopped");
    this.confirmedHead.reject(new Error("Game sync runtime stopped"));
    this.recentTransactions.clear();
    this.localTransactions.clear();
    this.status = "stopped";
  }

  private async runRecovery(): Promise<void> {
    const session = this.session;
    if (!session) throw new Error("GameSyncRuntime has no session to recover");

    const generation = this.beginRun("subscribing");
    const recoveryStartedAt = this.now();
    this.snapshotAppliedOperations = 0;
    this.snapshotExpectedOperations = 0;
    this.ingestQueue = this.createIngestQueue(session);
    const firstSnapshot = (this.firstSnapshot = createDeferred());

    try {
      const writer = await session.transport.subscribe(this.createStreamHandlers(generation, session, firstSnapshot));
      this.adoptWriter(generation, writer);
      session.onSubscriptionActive?.();

      this.status = "snapshotting";
      this.snapshotStreaming = true;
      await firstSnapshot.promise;
      this.assertCurrentGeneration(generation);
      await this.ingestQueue.drain();
      this.assertCurrentGeneration(generation);
      this.snapshotStreaming = false;
      if (this.snapshotExpectedOperations > 0) this.reportSnapshotApplyProgress();

      this.status = "running";
      this.firstSnapshot = null;
      this.metrics.lastRecoveryDurationMs = this.now() - recoveryStartedAt;
      this.publishMetrics();
    } catch (error) {
      this.stopFailedRun(generation);
      throw error;
    }
  }

  /** Herald's stream is ordered, so every delivery goes straight into the one ingest queue in arrival order. */
  private createStreamHandlers(
    generation: number,
    session: GameSyncSessionStart,
    firstSnapshot: Deferred,
  ): GameSyncSubscriptionHandlers {
    let snapshot: SnapshotAssembly | null = null;
    const current = () => this.isCurrentGeneration(generation);
    return {
      onSnapshotStart: () => {
        if (!current()) return;
        // Before the session runs, pieces are applied as they arrive; afterwards the refreshed snapshot is held and
        // replaces the store in one write, so a reconnect never shows a half-applied world.
        snapshot = {
          retained: new Map(session.snapshotModels.map((model) => [model, new Set<string>()])),
          held: this.status === "running" ? [] : null,
        };
      },
      onSnapshotModel: (model, facts, progress) => {
        if (!current() || !snapshot) return;
        this.metrics.snapshotPageCount += 1;
        this.metrics.snapshotEntityCount += facts.length;
        this.reportSnapshotReceived(session, progress);
        const keys = snapshot.retained.get(model) ?? new Set<string>();
        snapshot.retained.set(model, keys);
        facts.forEach((fact) => keys.add(fact.key));
        if (snapshot.held) {
          snapshot.held.push(...facts);
          return;
        }
        this.snapshotExpectedOperations += facts.length;
        for (let start = 0; start < facts.length; start += SNAPSHOT_PIECE_FACTS)
          void this.ingestQueue?.enqueueFacts(facts.slice(start, start + SNAPSHOT_PIECE_FACTS));
      },
      onSnapshotEnd: () => {
        if (!current() || !snapshot) return false;
        const { held, retained } = snapshot;
        snapshot = null;
        const replaced = this.enqueueReplacement(generation, held ?? [], retained);
        if (held)
          void replaced.then((applied) => {
            if (applied && current()) this.resyncListeners.forEach((listener) => listener());
          });
        firstSnapshot.resolve();
        return replaced.then((applied) => applied && current());
      },
      onScope: (facts, expedition) => {
        if (!current()) return false;
        const retained = new Map(
          session.snapshotModels
            .filter((model) => isScopedGameSyncModel(model, expedition))
            .map((model) => [model, new Set(facts.filter((fact) => fact.model === model).map((fact) => fact.key))]),
        );
        return this.enqueueReplacement(generation, facts, retained).then((applied) => applied && current());
      },
      onFacts: (batch) => {
        if (!current()) return;
        this.recordLiveUpdates("entity", batch.facts.length);
        const { transactionHash } = batch;
        if (transactionHash) session.onTransactionEntitiesReceived?.(transactionHash);
        const isLocalTransaction =
          transactionHash !== undefined && this.localTransactions.has(normalizeTransactionHash(transactionHash));
        void this.ingestQueue
          ?.enqueueFacts(batch.facts, { immediate: batch.preconfirmed && isLocalTransaction })
          .then(() => {
            if (transactionHash) session.onTransactionEntitiesApplied?.(transactionHash);
          })
          .catch((error) => this.stopAfterLiveBatchFailure(generation, error));
      },
      onEvent: (event, confirmation) => {
        if (!current()) return;
        this.recordLiveUpdates("event", 1);
        this.enqueueEventOnce(event, confirmation);
      },
      onHead: (head) => {
        if (!current()) return;
        session.onHead?.(head);
        if (!head.preconfirmed) this.confirmedHead.resolve();
      },
      onTransaction: (transaction) => {
        if (!current()) return;
        // A status follows its rows on the wire, but their scheduled store write may still be pending.
        void this.ingestQueue
          ?.drain()
          .then(() => {
            if (current()) this.acceptTransaction(transaction);
          })
          .catch((error) => this.stopAfterLiveBatchFailure(generation, error));
      },
      onStartFailure: (error) => {
        if (current()) firstSnapshot.reject(error);
      },
    };
  }

  /** Resolves true once the replacement is in the store, false if it failed (which stops the live stream). */
  private enqueueReplacement(
    generation: number,
    facts: GameSyncFact[],
    retained: Map<string, Set<string>>,
  ): Promise<boolean> {
    if (!this.ingestQueue) return Promise.resolve(false);
    return this.ingestQueue.enqueueFacts(facts, { retain: retained }).then(
      () => true,
      (error) => {
        this.stopAfterLiveBatchFailure(generation, error);
        return false;
      },
    );
  }

  private reportSnapshotReceived(
    session: GameSyncSessionStart,
    { bytesReceived, modelsReceived }: GameSyncSnapshotChunkProgress,
  ): void {
    session.onSnapshotProgress?.({
      bytesReceived,
      completed: Math.min(modelsReceived, session.snapshotModels.length),
      phase: "receiving",
      streaming: modelsReceived < session.snapshotModels.length,
      total: session.snapshotModels.length,
    });
  }

  private reportSnapshotApplyProgress(): void {
    this.session?.onSnapshotProgress?.({
      completed: Math.min(this.snapshotAppliedOperations, this.snapshotExpectedOperations),
      phase: "applying",
      streaming: this.snapshotStreaming,
      total: this.snapshotExpectedOperations,
    });
  }

  private enqueueEventOnce(event: GameSyncEvent, confirmation: GameSyncEventConfirmation): void {
    const session = this.session;
    if (!session) return;

    const identity = eventIdentity(event);
    const previous = this.recentEventIdentities.get(identity);
    const rank = eventConfirmationRank(confirmation);
    if (previous !== undefined && rank <= previous) return;

    this.recentEventIdentities.set(identity, rank);
    const limit = session.eventIdentityLimit ?? DEFAULT_EVENT_IDENTITY_LIMIT;
    while (this.recentEventIdentities.size > limit) {
      const oldest = this.recentEventIdentities.keys().next().value;
      if (oldest === undefined) break;
      this.recentEventIdentities.delete(oldest);
    }
    try {
      session.onEvent?.(event, confirmation);
    } catch (error) {
      // Events are ephemera: a presentation failure must not abort the diff carrying fact rows.
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[GameSync] event handler failed for ${event.model}: ${message}`);
    }
    // Promote the story's metadata without replaying its already-delivered ephemeral effects.
    if (previous === undefined) this.ingestQueue?.enqueueEvent(event);
  }

  private createIngestQueue(session: GameSyncSessionStart): FactIngestQueue {
    return new FactIngestQueue({
      scheduler: session.scheduler ?? createMicrotaskGameSyncScheduler(),
      store: session.store,
      now: session.now ?? (() => Date.now()),
      onBatchApplied: (info) => this.recordAppliedBatch(info),
    });
  }

  private recordAppliedBatch(info: FactIngestBatchInfo): void {
    this.metrics.appliedBatchCount += 1;
    this.metrics.maxBatchApplyDurationMs = Math.max(this.metrics.maxBatchApplyDurationMs, info.applyDurationMs);
    if (this.status === "replaying" || this.status === "running") {
      this.metrics.totalLiveEntityOperationsApplied += info.operationCount;
    }
    // The replay of the boot backlog is boot work; the live max is the churn number the gate asks for.
    if (this.status === "running") {
      this.metrics.maxLiveBatchApplyDurationMs = Math.max(
        this.metrics.maxLiveBatchApplyDurationMs,
        info.applyDurationMs,
      );
    }
    if (this.status === "snapshotting") {
      this.metrics.snapshotApplyDurationMs += info.applyDurationMs;
      if (this.snapshotExpectedOperations > 0) {
        this.snapshotAppliedOperations += info.operationCount;
        this.reportSnapshotApplyProgress();
      }
    }
    this.worldSpatialProjection?.flush();
    this.sliceAppliedListeners.forEach((listener) => listener());
    this.publishMetrics();
  }

  /** Liveness is a per-batch fact: one callback per delivery, however many rows it carried. */
  private recordLiveUpdates(kind: "entity" | "event", count: number): void {
    const session = this.session;
    if (!session || count === 0) return;

    if (kind === "entity") this.metrics.totalLiveEntityUpdates += count;
    else this.metrics.totalLiveEventUpdates += count;

    const now = this.now();
    this.liveUpdateSamples.push({ at: now, count });
    while (this.liveUpdateSamples.length > 0 && this.liveUpdateSamples[0].at < now - 1_000)
      this.liveUpdateSamples.shift();
    const updatesInWindow = this.liveUpdateSamples.reduce((sum, sample) => sum + sample.count, 0);
    const nextPeak = Math.max(this.metrics.peakLiveUpdatesPerSecond, updatesInWindow);
    const peakChanged = nextPeak !== this.metrics.peakLiveUpdatesPerSecond;
    this.metrics.peakLiveUpdatesPerSecond = nextPeak;
    session.onLiveUpdate?.(kind);
    if (peakChanged) this.publishMetrics();
  }

  private publishMetrics(): void {
    this.session?.onMetrics?.(this.getMetrics());
  }

  private acceptTransaction(transaction: GameSyncTransaction): void {
    const identity = normalizeTransactionHash(transaction.hash);
    this.recentTransactions.delete(identity);
    this.recentTransactions.set(identity, transaction);
    while (this.recentTransactions.size > DEFAULT_TRANSACTION_STATUS_LIMIT) {
      const oldest = this.recentTransactions.keys().next().value;
      if (oldest === undefined) break;
      this.recentTransactions.delete(oldest);
    }
    this.session?.onTransaction?.(transaction);
    const waiters = this.transactionWaiters.get(identity);
    if (!waiters) return;
    this.transactionWaiters.delete(identity);
    waiters.forEach(({ reject, resolve }) => {
      if (transaction.status === "REVERTED") reject(transactionError(transaction));
      else resolve(transaction);
    });
  }

  private rejectTransactionWaiters(message: string): void {
    this.transactionWaiters.forEach((waiters) => waiters.forEach(({ reject }) => reject(new Error(message))));
    this.transactionWaiters.clear();
  }

  private now(): number {
    return this.session?.now?.() ?? Date.now();
  }

  private beginRun(status: GameSyncRuntimeStatus): number {
    this.generation += 1;
    this.abandonFirstSnapshot();
    this.cancelWriterImmediately();
    this.ingestQueue?.dispose();
    this.ingestQueue = null;
    this.status = status;
    return this.generation;
  }

  private abandonFirstSnapshot(): void {
    this.firstSnapshot?.reject(new SupersededGameSyncStartError());
    this.firstSnapshot = null;
  }

  private adoptWriter(generation: number, writer: GameSyncWriter): void {
    if (!this.isCurrentGeneration(generation)) {
      writer.cancel();
      throw new SupersededGameSyncStartError();
    }
    this.writer = writer;
  }

  private assertCurrentGeneration(generation: number): void {
    if (!this.isCurrentGeneration(generation)) throw new SupersededGameSyncStartError();
  }

  private stopFailedRun(generation: number): void {
    if (!this.isCurrentGeneration(generation)) return;
    this.cancelWriterImmediately();
    this.ingestQueue?.dispose();
    this.ingestQueue = null;
    this.rejectTransactionWaiters("Game sync recovery failed");
    this.status = "stopped";
  }

  private stopAfterLiveBatchFailure(generation: number, error: unknown): void {
    if (!this.isCurrentGeneration(generation) || this.status !== "running") return;
    const failure = error instanceof Error ? error : new Error(String(error));
    this.session?.onError?.(failure);
    this.stopFailedRun(generation);
  }

  private isCurrentGeneration(generation: number): boolean {
    return generation === this.generation;
  }

  private cancelWriterImmediately(): void {
    this.writer?.cancel();
    this.writer = null;
  }

  private disposeWorldSpatialProjection(): void {
    this.worldSpatialProjection?.dispose();
    this.worldSpatialProjection = null;
  }
}

let activeGameSyncRuntime: GameSyncRuntime | null = null;

export function getActiveGameSyncRuntime(): GameSyncRuntime | null {
  return activeGameSyncRuntime;
}

export function requireActiveGameSyncRuntime(): GameSyncRuntime {
  if (!activeGameSyncRuntime) throw new Error("GameSyncRuntime has not been installed for the active game");
  return activeGameSyncRuntime;
}

export function installGameSyncRuntime(runtime: GameSyncRuntime): GameSyncRuntime {
  activeGameSyncRuntime?.dispose();
  activeGameSyncRuntime = runtime;
  return runtime;
}

export function installFreshGameSyncRuntime(): GameSyncRuntime {
  return installGameSyncRuntime(new GameSyncRuntime());
}

export function disposeActiveGameSyncRuntime(): void {
  activeGameSyncRuntime?.dispose();
  activeGameSyncRuntime = null;
}

function normalizeTransactionHash(transactionHash: string): string {
  try {
    return `0x${BigInt(transactionHash).toString(16)}`;
  } catch {
    return transactionHash.toLowerCase();
  }
}

function transactionError(transaction: GameSyncTransaction): Error {
  return new Error(transaction.revertReason ?? `Transaction ${transaction.hash} reverted`);
}

function settleTransaction(transaction: GameSyncTransaction): Promise<GameSyncTransaction> {
  return transaction.status === "REVERTED"
    ? Promise.reject(transactionError(transaction))
    : Promise.resolve(transaction);
}

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

function createDeferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  // A start superseded before it awaits the snapshot learns so from its own generation check instead.
  promise.catch(() => undefined);
  return { promise, resolve, reject };
}
