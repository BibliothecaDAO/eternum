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
    const steps = this.steps;
    this.steps = [];
    const startedAt = this.now();
    let operationCount = 0;

    try {
      const entityOperations: GameSyncEntityStoreOperation[] = [];
      const applyEntityOperations = async () => {
        if (entityOperations.length === 0) return;
        await this.store.applyEntityOperations(entityOperations.splice(0));
      };

      for (const step of steps) {
        if (step.type === "upsert") {
          const entities = [...step.entities.values()];
          operationCount += entities.reduce((count, entity) => count + Object.keys(entity.models).length, 0);
          entityOperations.push({ type: "upsert", entities });
          continue;
        }
        if (step.type === "entity-barrier") {
          operationCount += 1;
          entityOperations.push(step.operation);
          continue;
        }

        await applyEntityOperations();
        operationCount += 1;
        await this.store.applyEvent(step.event);
      }

      await applyEntityOperations();
      this.appliedOperationId = Math.max(this.appliedOperationId, ...steps.map(({ operationId }) => operationId));
      this.onBatchApplied?.({ applyDurationMs: this.now() - startedAt, operationCount });
    } catch (error) {
      this.failure = error instanceof Error ? error : new Error(String(error));
      this.steps = [];
    } finally {
      this.flushing = false;
      this.resolveDrainWaiters();
      this.scheduleFlush();
    }
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
