import type { GameSyncEntity, GameSyncEntityStoreOperation, GameSyncStore } from "./game-sync-types";
import type { GameSyncScheduler } from "./scheduler";

type UpsertStep = {
  type: "upsert";
  entities: Map<string, GameSyncEntity>;
  operationId: number;
};

type EntityBarrierStep = {
  type: "entity-barrier";
  operation: Exclude<GameSyncEntityStoreOperation, { type: "upsert" }>;
  operationId: number;
};

type EventStep = {
  type: "event";
  event: GameSyncEntity;
  operationId: number;
};

type IngestStep = UpsertStep | EntityBarrierStep | EventStep;

type ApplyBatch =
  | {
      type: "entities";
      completedOperationIds: number[];
      operationCount: number;
      operations: GameSyncEntityStoreOperation[];
    }
  | { type: "event"; completedOperationIds: number[]; event: GameSyncEntity; operationCount: 1 };

interface DrainWaiter {
  operationId: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

export interface EntityIngestBatchInfo {
  applyDurationMs: number;
  operationCount: number;
}

interface EntityIngestQueueOptions {
  scheduler: GameSyncScheduler;
  store: GameSyncStore;
  now: () => number;
  onBatchApplied?: (info: EntityIngestBatchInfo) => void;
}

const isEmptyModel = (model: unknown): boolean =>
  typeof model === "object" && model !== null && !Array.isArray(model) && Object.keys(model).length === 0;

const MAX_APPLY_SLICE_MS = 25;
// The wall-clock slice is the normal yield boundary. This cap only protects
// against a pathological delivery growing a single store write without bound.
const MAX_ENTITY_CHANGES_PER_STORE_WRITE = 1_000;

const mergeEntityModel = (entities: Map<string, GameSyncEntity>, entityId: string, model: string, value: unknown) => {
  const existing = entities.get(entityId);
  // Torii deliveries are partial per model member. Coalescing two partials for
  // the same entity+model must union their members — replacing wholesale drops
  // every earlier member of a same-frame burst (e.g. a provision tx) before it
  // ever reaches the store.
  const existingModel = existing?.models?.[model];
  const mergedValue =
    typeof existingModel === "object" && existingModel !== null && typeof value === "object" && value !== null
      ? { ...existingModel, ...value }
      : value;
  entities.set(entityId, {
    hashed_keys: entityId,
    models: {
      ...existing?.models,
      [model]: mergedValue,
    },
  });
};

export class EntityIngestQueue {
  private readonly scheduler: GameSyncScheduler;
  private readonly store: GameSyncStore;
  private readonly now: () => number;
  private readonly onBatchApplied?: (info: EntityIngestBatchInfo) => void;
  private steps: IngestStep[] = [];
  private drainWaiters: DrainWaiter[] = [];
  private cancelScheduledFlush: (() => void) | null = null;
  private flushing = false;
  private disposed = false;
  private nextOperationId = 1;
  private appliedOperationId = 0;
  private failure: Error | null = null;

  constructor({ scheduler, store, now, onBatchApplied }: EntityIngestQueueOptions) {
    this.scheduler = scheduler;
    this.store = store;
    this.now = now;
    this.onBatchApplied = onBatchApplied;
  }

  public enqueueEntity(entity: GameSyncEntity): void {
    if (this.disposed) return;

    const modelEntries = Object.entries(entity.models ?? {});
    if (modelEntries.length === 0) {
      this.enqueueEntityBarrier({ type: "delete-entity", entityId: entity.hashed_keys });
      return;
    }

    const upserts = modelEntries.filter(([, model]) => !isEmptyModel(model));
    const removals = modelEntries.filter(([, model]) => isEmptyModel(model)).map(([model]) => model);

    if (upserts.length > 0) {
      const step = this.resolveUpsertStep();
      upserts.forEach(([model, value]) => mergeEntityModel(step.entities, entity.hashed_keys, model, value));
      step.operationId = this.nextOperationId++;
    }

    if (removals.length > 0) {
      this.enqueueEntityBarrier({ type: "remove-components", entityId: entity.hashed_keys, models: removals });
    }

    this.scheduleFlush();
  }

  public enqueueComponentRemoval(entityId: string, model: string): void {
    if (this.disposed) return;
    this.enqueueEntityBarrier({ type: "remove-components", entityId, models: [model] });
    this.scheduleFlush();
  }

  public enqueueEvent(event: GameSyncEntity): void {
    if (this.disposed) return;
    this.steps.push({ type: "event", event, operationId: this.nextOperationId++ });
    this.scheduleFlush();
  }

  public drain(): Promise<void> {
    const operationId = this.nextOperationId - 1;
    if (this.failure) return Promise.reject(this.failure);
    if (operationId <= this.appliedOperationId || this.disposed) return Promise.resolve();

    this.scheduleFlush();
    return new Promise<void>((resolve, reject) => {
      this.drainWaiters.push({ operationId, resolve, reject });
    });
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

  private resolveUpsertStep(): UpsertStep {
    const lastStep = this.steps[this.steps.length - 1];
    if (lastStep?.type === "upsert") return lastStep;

    const step: UpsertStep = { type: "upsert", entities: new Map(), operationId: 0 };
    this.steps.push(step);
    return step;
  }

  private enqueueEntityBarrier(operation: EntityBarrierStep["operation"]): void {
    this.steps.push({ type: "entity-barrier", operation, operationId: this.nextOperationId++ });
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

    try {
      while (this.steps.length > 0) {
        const batch = this.takeNextApplyBatch();
        await this.applyBatch(batch);
        operationCount += batch.operationCount;
        if (batch.completedOperationIds.length > 0) {
          this.appliedOperationId = Math.max(this.appliedOperationId, ...batch.completedOperationIds);
        }
        if (this.now() - startedAt >= MAX_APPLY_SLICE_MS) {
          break;
        }
      }

      if (operationCount > 0) {
        this.onBatchApplied?.({ applyDurationMs: this.now() - startedAt, operationCount });
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

  private takeNextApplyBatch(): ApplyBatch {
    const firstStep = this.steps[0];
    if (firstStep.type === "event") {
      this.steps.shift();
      return {
        type: "event",
        completedOperationIds: [firstStep.operationId],
        event: firstStep.event,
        operationCount: 1,
      };
    }

    const completedOperationIds: number[] = [];
    const operations: GameSyncEntityStoreOperation[] = [];
    let entityChangeCount = 0;
    let operationCount = 0;

    while (this.steps.length > 0 && entityChangeCount < MAX_ENTITY_CHANGES_PER_STORE_WRITE) {
      const step = this.steps[0];
      if (step.type === "event") {
        break;
      }

      if (step.type === "entity-barrier") {
        this.steps.shift();
        operations.push(step.operation);
        completedOperationIds.push(step.operationId);
        entityChangeCount += 1;
        operationCount += 1;
        continue;
      }

      const remainingCapacity = MAX_ENTITY_CHANGES_PER_STORE_WRITE - entityChangeCount;
      const entries = [...step.entities.entries()].slice(0, remainingCapacity);
      const entities = entries.map(([, entity]) => entity);
      entries.forEach(([entityId]) => step.entities.delete(entityId));
      operations.push({ type: "upsert", entities });
      entityChangeCount += entities.length;
      operationCount += entities.reduce((count, entity) => count + Object.keys(entity.models).length, 0);
      if (step.entities.size === 0) {
        this.steps.shift();
        completedOperationIds.push(step.operationId);
      }
    }

    return { type: "entities", completedOperationIds, operationCount, operations };
  }

  private async applyBatch(batch: ApplyBatch): Promise<void> {
    if (batch.type === "event") {
      await this.store.applyEvent(batch.event);
      return;
    }

    await this.store.applyEntityOperations(batch.operations);
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
