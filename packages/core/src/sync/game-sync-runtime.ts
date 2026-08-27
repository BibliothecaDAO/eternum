import { EntityIngestQueue, type EntityIngestBatchInfo } from "./entity-ingest-queue";
import type {
  GameSyncEntity,
  GameSyncProvisionalWrite,
  GameSyncRuntimeMetrics,
  GameSyncSessionStart,
  GameSyncTransaction,
  GameSyncWriter,
} from "./game-sync-types";
import {
  ProvisionalWriteManager,
  type ProvisionalIntent,
  type ProvisionalIntentLockUntil,
} from "./provisional-write-manager";
import { createMicrotaskGameSyncScheduler } from "./scheduler";
import type { WorldSpatialProjection } from "./world-spatial-projection";

export type GameSyncRuntimeStatus = "idle" | "subscribing" | "snapshotting" | "replaying" | "running" | "stopped";

export class SupersededGameSyncStartError extends Error {
  constructor() {
    super("Game sync start was superseded by a newer session");
    this.name = "SupersededGameSyncStartError";
  }
}

interface BufferedEntityUpdate {
  entity: GameSyncEntity;
  receiveSequence: number;
}

const DEFAULT_EVENT_IDENTITY_LIMIT = 512;
const DEFAULT_TRANSACTION_STATUS_LIMIT = 512;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const resolveEventTimestamp = (model: string, value: unknown): string => {
  if (!isRecord(value) || !("timestamp" in value)) {
    throw new Error(`Game sync event ${model} is missing its timestamp`);
  }

  const timestampField = value.timestamp;
  const timestamp = isRecord(timestampField) && "value" in timestampField ? timestampField.value : timestampField;
  if (!["bigint", "number", "string"].includes(typeof timestamp)) {
    throw new Error(`Game sync event ${model} has an invalid timestamp`);
  }

  return String(timestamp);
};

const createEmptyMetrics = (): GameSyncRuntimeMetrics => ({
  appliedBatchCount: 0,
  eventGapFillReplayCount: 0,
  lastRecoveryDurationMs: 0,
  maxBatchApplyDurationMs: 0,
  peakLiveUpdatesPerSecond: 0,
  snapshotEntityCount: 0,
  snapshotPageCount: 0,
  totalLiveEntityUpdates: 0,
  totalLiveEventUpdates: 0,
  totalReplayedEventUpdates: 0,
});

/** Owns the session-scoped stream, snapshot hydration, and ordered RECS writes. */
export class GameSyncRuntime {
  private generation = 0;
  private writer: GameSyncWriter | null = null;
  private status: GameSyncRuntimeStatus = "idle";
  private session: GameSyncSessionStart | null = null;
  private ingestQueue: EntityIngestQueue | null = null;
  private worldSpatialProjection: WorldSpatialProjection | null = null;
  private provisionalWriteManager: ProvisionalWriteManager | null = null;
  private recentEventIdentities = new Map<string, true>();
  private liveUpdateTimestamps: number[] = [];
  private receiveSequence = 0;
  private metrics = createEmptyMetrics();
  private recentTransactions = new Map<string, GameSyncTransaction>();
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

  public async startSession(input: GameSyncSessionStart): Promise<void> {
    this.disposeWorldSpatialProjection();
    this.provisionalWriteManager?.dispose();
    this.session = input;
    this.provisionalWriteManager = new ProvisionalWriteManager(input.store, {
      onIntentStalled: input.onProvisionalIntentStalled,
      onIntentPhase: input.onProvisionalIntentPhase,
    });
    this.recentEventIdentities.clear();
    this.rejectTransactionWaiters("Game sync session was replaced");
    this.recentTransactions.clear();
    this.liveUpdateTimestamps = [];
    this.receiveSequence = 0;
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

  public installWorldSpatialProjection(projection: WorldSpatialProjection): void {
    this.disposeWorldSpatialProjection();
    try {
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

  public createProvisionalIntent(
    writes: readonly GameSyncProvisionalWrite[],
    options: { lockUntil?: ProvisionalIntentLockUntil } = {},
  ): ProvisionalIntent {
    if (!this.provisionalWriteManager) {
      throw new Error("GameSyncRuntime has no active provisional write manager");
    }
    return this.provisionalWriteManager.createIntent(writes, options);
  }

  public hasProvisionalInputLock(model: string, entityId: string): boolean {
    return this.provisionalWriteManager?.hasInputLock(model, entityId) ?? false;
  }

  public isProvisionalOnly(model: string, entityId: string): boolean {
    return this.provisionalWriteManager?.isProvisionalOnly(model, entityId) ?? false;
  }

  public subscribeProvisionalState(listener: () => void): () => void {
    return this.provisionalWriteManager?.subscribe(listener) ?? (() => {});
  }

  public async applyAuthoritativeEntities(entities: readonly GameSyncEntity[]): Promise<void> {
    if (this.status !== "running" || !this.ingestQueue) {
      throw new Error("GameSyncRuntime cannot apply an authoritative query outside a running session");
    }
    entities.forEach((entity) => this.ingestQueue?.enqueueEntity(entity));
    await this.ingestQueue.drain();
  }

  public dispose(): void {
    this.generation += 1;
    this.cancelWriterImmediately();
    this.disposeWorldSpatialProjection();
    this.ingestQueue?.dispose();
    this.ingestQueue = null;
    this.provisionalWriteManager?.dispose();
    this.provisionalWriteManager = null;
    this.session = null;
    this.rejectTransactionWaiters("Game sync runtime stopped");
    this.recentTransactions.clear();
    this.status = "stopped";
  }

  private async runRecovery(): Promise<void> {
    const session = this.session;
    if (!session) throw new Error("GameSyncRuntime has no session to recover");

    const generation = this.beginRun("subscribing");
    const recoveryStartedAt = this.now();
    const bufferedUpdates: BufferedEntityUpdate[] = [];
    const existingEntitiesByModel = this.captureExistingEntities(session);
    const seenEntitiesByModel = new Map(session.snapshotModels.map((model) => [model, new Set<string>()]));
    this.ingestQueue = this.createIngestQueue(session);

    try {
      const writer = await session.transport.subscribe({
        onEntity: (entity) => {
          if (!this.isCurrentGeneration(generation)) return;
          const update = { entity, receiveSequence: ++this.receiveSequence };
          this.recordLiveUpdate("entity");
          if (this.status === "running") this.ingestQueue?.enqueueEntity(entity);
          else bufferedUpdates.push(update);
        },
        onEvent: (event) => {
          if (!this.isCurrentGeneration(generation)) return;
          this.recordLiveUpdate("event");
          this.enqueueEventOnce(event);
        },
        onEventGapFill: (replayedEventCount) => {
          if (!this.isCurrentGeneration(generation) || replayedEventCount <= 0) return;
          this.metrics.eventGapFillReplayCount += 1;
          this.metrics.totalReplayedEventUpdates += replayedEventCount;
          this.publishMetrics();
        },
        onHead: (head) => {
          if (!this.isCurrentGeneration(generation)) return;
          session.onHead?.(head);
        },
        onTransaction: (transaction) => {
          if (!this.isCurrentGeneration(generation)) return;
          this.acceptTransaction(transaction);
        },
      });
      this.adoptWriter(generation, writer);
      session.onSubscriptionActive?.();

      this.status = "snapshotting";
      await this.hydrateSnapshot(generation, session, seenEntitiesByModel);
      this.reconcileAbsentSnapshotComponents(existingEntitiesByModel, seenEntitiesByModel);
      await this.ingestQueue.drain();

      this.status = "replaying";
      await this.replayBufferedUpdates(generation, bufferedUpdates);
      this.assertCurrentGeneration(generation);
      this.status = "running";
      this.metrics.lastRecoveryDurationMs = this.now() - recoveryStartedAt;
      this.publishMetrics();
    } catch (error) {
      this.stopFailedRun(generation);
      throw error;
    }
  }

  private captureExistingEntities(session: GameSyncSessionStart): Map<string, Set<string>> {
    return new Map(
      session.snapshotModels.map((model) => [model, new Set(session.store.listModelEntityIds(model))] as const),
    );
  }

  private async hydrateSnapshot(
    generation: number,
    session: GameSyncSessionStart,
    seenEntitiesByModel: Map<string, Set<string>>,
  ): Promise<void> {
    const visitedCursors = new Set<string>();
    let cursor: string | undefined;

    do {
      const page = await session.transport.fetchSnapshotPage(cursor);
      this.assertCurrentGeneration(generation);
      this.metrics.snapshotPageCount += 1;
      this.metrics.snapshotEntityCount += page.items.length;

      page.items.forEach((entity) => {
        Object.keys(entity.models).forEach((model) => seenEntitiesByModel.get(model)?.add(entity.hashed_keys));
        this.ingestQueue?.enqueueEntity(entity);
      });
      await this.ingestQueue?.drain();

      cursor = page.nextCursor;
      if (cursor) {
        if (visitedCursors.has(cursor)) throw new Error(`Game sync snapshot cursor repeated: ${cursor}`);
        visitedCursors.add(cursor);
      }
    } while (cursor);
  }

  private reconcileAbsentSnapshotComponents(
    existingEntitiesByModel: Map<string, Set<string>>,
    seenEntitiesByModel: Map<string, Set<string>>,
  ): void {
    existingEntitiesByModel.forEach((existingEntities, model) => {
      const seenEntities = seenEntitiesByModel.get(model) ?? new Set<string>();
      existingEntities.forEach((entityId) => {
        if (!seenEntities.has(entityId)) this.ingestQueue?.enqueueComponentRemoval(entityId, model);
      });
    });
  }

  private async replayBufferedUpdates(generation: number, bufferedUpdates: BufferedEntityUpdate[]): Promise<void> {
    while (bufferedUpdates.length > 0) {
      this.assertCurrentGeneration(generation);
      const replay = bufferedUpdates.splice(0).sort((left, right) => left.receiveSequence - right.receiveSequence);
      replay.forEach(({ entity }) => this.ingestQueue?.enqueueEntity(entity));
      await this.ingestQueue?.drain();
    }
  }

  private enqueueEventOnce(event: GameSyncEntity): void {
    const session = this.session;
    if (!session) return;

    Object.entries(event.models).forEach(([model, value]) => {
      const identity = `${model}:${event.hashed_keys}:${resolveEventTimestamp(model, value)}`;
      if (this.recentEventIdentities.has(identity)) return;

      this.recentEventIdentities.set(identity, true);
      const limit = session.eventIdentityLimit ?? DEFAULT_EVENT_IDENTITY_LIMIT;
      while (this.recentEventIdentities.size > limit) {
        const oldest = this.recentEventIdentities.keys().next().value;
        if (oldest === undefined) break;
        this.recentEventIdentities.delete(oldest);
      }
      this.ingestQueue?.enqueueEvent({ hashed_keys: event.hashed_keys, models: { [model]: value } });
    });
  }

  private createIngestQueue(session: GameSyncSessionStart): EntityIngestQueue {
    return new EntityIngestQueue({
      scheduler: session.scheduler ?? createMicrotaskGameSyncScheduler(),
      store: session.store,
      now: session.now ?? (() => Date.now()),
      onBatchApplied: (info) => this.recordAppliedBatch(info),
      onAuthoritativeObservationsApplied: (observations) =>
        this.provisionalWriteManager?.observeAuthoritativeObservations(observations),
    });
  }

  private recordAppliedBatch(info: EntityIngestBatchInfo): void {
    this.metrics.appliedBatchCount += 1;
    this.metrics.maxBatchApplyDurationMs = Math.max(this.metrics.maxBatchApplyDurationMs, info.applyDurationMs);
  }

  private recordLiveUpdate(kind: "entity" | "event"): void {
    const session = this.session;
    if (!session) return;

    if (kind === "entity") this.metrics.totalLiveEntityUpdates += 1;
    else this.metrics.totalLiveEventUpdates += 1;

    const now = this.now();
    this.liveUpdateTimestamps.push(now);
    while (this.liveUpdateTimestamps[0] < now - 1_000) this.liveUpdateTimestamps.shift();
    const nextPeak = Math.max(this.metrics.peakLiveUpdatesPerSecond, this.liveUpdateTimestamps.length);
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
    this.cancelWriterImmediately();
    this.ingestQueue?.dispose();
    this.ingestQueue = null;
    this.status = status;
    return this.generation;
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
