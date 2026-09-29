import type {
  GameSyncEvent,
  GameSyncFact,
  GameSyncRetainedKeys,
  GameSyncSnapshotState,
  GameSyncStore,
} from "./game-sync-types";
import type { GameSyncScheduler } from "./scheduler";

type FactStep = { type: "facts"; facts: readonly GameSyncFact[]; retain?: GameSyncRetainedKeys; operationId: number };
type EventStep = { type: "event"; event: GameSyncEvent; operationId: number };
type SnapshotStep = { type: "snapshot"; state: GameSyncSnapshotState; operationId: number };
type IngestStep = FactStep | EventStep | SnapshotStep;

interface DrainWaiter {
  operationId: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

export interface FactIngestBatchInfo {
  applyDurationMs: number;
  /** Event effects applied in the slice; kept apart so the fact count stays comparable with rows received. */
  eventCount: number;
  /** Facts written or removed in the slice. */
  operationCount: number;
}

interface FactIngestQueueOptions {
  scheduler: GameSyncScheduler;
  store: GameSyncStore;
  now: () => number;
  onBatchApplied?: (info: FactIngestBatchInfo) => void;
}

// One frame's budget, the same number the scene's work queue uses.
const MAX_APPLY_SLICE_MS = 6;
// Steps queued in the same frame share one store write up to this size. A single step is never split, so one
// Herald diff (one player action) always lands in one write; only bulk snapshot work is enqueued in pieces.
const MAX_FACTS_PER_STORE_WRITE = 1_000;

/**
 * Orders every store write of a session: snapshot pieces, replacements, diffs and events, in stream order. Writes run
 * in frame-sized slices so ambient churn is spread; an immediate enqueue (the player's own action) flushes at once.
 */
export class FactIngestQueue {
  private readonly scheduler: GameSyncScheduler;
  private readonly store: GameSyncStore;
  private readonly now: () => number;
  private readonly onBatchApplied?: (info: FactIngestBatchInfo) => void;
  private steps: IngestStep[] = [];
  private drainWaiters: DrainWaiter[] = [];
  private cancelScheduledFlush: (() => void) | null = null;
  private flushing = false;
  private disposed = false;
  private nextOperationId = 1;
  private appliedOperationId = 0;
  private flushThroughOperationId = 0;
  private failure: Error | null = null;

  constructor({ scheduler, store, now, onBatchApplied }: FactIngestQueueOptions) {
    this.scheduler = scheduler;
    this.store = store;
    this.now = now;
    this.onBatchApplied = onBatchApplied;
  }

  /** Resolves once these facts are in the store; `retain` makes the step a replacement of the listed models. */
  public enqueueFacts(
    facts: readonly GameSyncFact[],
    options: { retain?: GameSyncRetainedKeys; immediate?: boolean } = {},
  ): Promise<void> {
    if (this.disposed || (facts.length === 0 && !options.retain)) return Promise.resolve();
    const operationId = this.nextOperationId++;
    this.steps.push({ type: "facts", facts, retain: options.retain, operationId });
    if (options.immediate) {
      this.flushThroughOperationId = Math.max(this.flushThroughOperationId, operationId);
      this.cancelScheduledFlush?.();
      this.cancelScheduledFlush = null;
      void this.flush();
    } else {
      this.scheduleFlush();
    }
    return this.waitForOperation(operationId);
  }

  public enqueueEvent(event: GameSyncEvent): void {
    if (this.disposed) return;
    this.steps.push({ type: "event", event, operationId: this.nextOperationId++ });
    this.scheduleFlush();
  }

  /** Gate writes follow the facts that justify them; queued diffs never close snapshot completion. */
  public enqueueSnapshot(state: GameSyncSnapshotState): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const operationId = this.nextOperationId++;
    this.steps.push({ type: "snapshot", state, operationId });
    this.scheduleFlush();
    return this.waitForOperation(operationId);
  }

  public drain(): Promise<void> {
    return this.waitForOperation(this.nextOperationId - 1);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelScheduledFlush?.();
    this.cancelScheduledFlush = null;
    this.steps = [];
    this.drainWaiters.forEach(({ resolve }) => resolve());
    this.drainWaiters = [];
  }

  private waitForOperation(operationId: number): Promise<void> {
    if (this.failure) return Promise.reject(this.failure);
    if (operationId <= this.appliedOperationId || this.disposed) return Promise.resolve();

    this.scheduleFlush();
    return new Promise<void>((resolve, reject) => {
      this.drainWaiters.push({ operationId, resolve, reject });
    });
  }

  private scheduleFlush(): void {
    if (this.disposed || this.flushing || this.cancelScheduledFlush || this.steps.length === 0) return;

    this.cancelScheduledFlush = this.scheduler.schedule(() => {
      this.cancelScheduledFlush = null;
      void this.flush();
    });
  }

  private async flush(): Promise<void> {
    if (this.disposed || this.flushing || this.steps.length === 0) return;

    this.flushing = true;
    const startedAt = this.now();
    let operationCount = 0;
    let eventCount = 0;

    try {
      while (this.steps.length > 0) {
        const write = this.takeNextWrite();
        if (write.type === "event") {
          await this.store.applyEvent(write.event);
          eventCount += 1;
        } else if (write.type === "snapshot") {
          this.store.setSnapshot?.(write.state);
        } else {
          await this.store.applyFacts(write.facts, write.retain);
          operationCount += write.facts.length;
        }
        this.appliedOperationId = write.operationId;
        if (this.now() - startedAt >= MAX_APPLY_SLICE_MS && this.appliedOperationId >= this.flushThroughOperationId) {
          break;
        }
      }

      if (operationCount > 0 || eventCount > 0) {
        this.onBatchApplied?.({ applyDurationMs: this.now() - startedAt, eventCount, operationCount });
      }
    } catch (error) {
      this.failure = error instanceof Error ? error : new Error(String(error));
      this.steps = [];
    } finally {
      this.flushing = false;
      this.resolveDrainWaiters();
      this.scheduleFlush();
    }
  }

  /** Whole steps only: consecutive plain fact steps share a write, a replacement or an event stands alone. */
  private takeNextWrite(): IngestStep {
    const first = this.steps.shift()!;
    if (first.type !== "facts" || first.retain) return first;

    const facts = [...first.facts];
    let operationId = first.operationId;
    while (this.steps.length > 0) {
      const next = this.steps[0];
      if (next.type !== "facts" || next.retain || facts.length + next.facts.length > MAX_FACTS_PER_STORE_WRITE) break;
      this.steps.shift();
      facts.push(...next.facts);
      operationId = next.operationId;
    }
    return { type: "facts", facts, operationId };
  }

  private resolveDrainWaiters(): void {
    if (this.failure) {
      this.drainWaiters.forEach(({ reject }) => reject(this.failure as Error));
      this.drainWaiters = [];
      return;
    }

    const pending: DrainWaiter[] = [];
    this.drainWaiters.forEach((waiter) => {
      if (waiter.operationId <= this.appliedOperationId) waiter.resolve();
      else pending.push(waiter);
    });
    this.drainWaiters = pending;
  }
}
