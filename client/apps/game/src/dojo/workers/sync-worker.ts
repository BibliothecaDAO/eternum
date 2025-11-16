/// <reference lib="webworker" />

interface ToriiPayload {
  hashed_keys: string;
  models: Record<string, unknown>;
  [key: string]: unknown;
}

type WorkerInitMessage = {
  type: "init";
  schemaVersion: number;
  batchSize: number;
  batchIntervalMs: number;
  warningThreshold?: number;
};

type WorkerUpdateMessage = {
  type: "torii-event";
  entityId: string;
  payload: ToriiPayload;
  origin: "entity" | "event";
};

type WorkerUpdateConfigMessage = {
  type: "update-config";
  batchSize?: number;
  batchIntervalMs?: number;
  warningThreshold?: number;
};

type WorkerCancelMessage = { type: "cancel-all" };

type InboundMessage = WorkerInitMessage | WorkerUpdateMessage | WorkerUpdateConfigMessage | WorkerCancelMessage;

type BatchReadyMessage = {
  type: "batch-ready";
  batchId: number;
  upserts: ToriiPayload[];
  deletions: string[];
  queueSize: number;
  elapsedMs: number;
};

type LogMessage = { type: "log"; level: "info" | "warn"; message: string; context?: Record<string, unknown> };
type ErrorMessage = { type: "error"; message: string; entityId?: string };
type ReadyMessage = { type: "ready" };

type OutboundMessage = BatchReadyMessage | LogMessage | ErrorMessage | ReadyMessage;

interface PendingEntity {
  payload: ToriiPayload;
  isDeletion: boolean;
}

declare const self: DedicatedWorkerGlobalScope;

const ctx = self;

let batchSize = 10;
let batchIntervalMs = 50;
let warningThreshold = 500;
let flushTimer: number | null = null;
let nextBatchId = 1;

const pending = new Map<string, PendingEntity>();
const queue: string[] = [];

const post = (message: OutboundMessage, transfer?: Transferable[]) => {
  ctx.postMessage(message, transfer ?? []);
};

const isDeletionPayload = (payload: ToriiPayload) => !payload.models || Object.keys(payload.models).length === 0;

const mergeDeep = (target: ToriiPayload, source: ToriiPayload): ToriiPayload => {
  const output: Record<string, unknown> = { ...target };

  Object.keys(source).forEach((key) => {
    const sourceValue = source[key];
    const targetValue = output[key];

    if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      output[key] = mergeDeep(targetValue as ToriiPayload, sourceValue as ToriiPayload);
    } else {
      output[key] = sourceValue;
    }
  });

  return output as ToriiPayload;
};

const scheduleFlush = () => {
  if (flushTimer !== null) {
    return;
  }
  flushTimer = ctx.setTimeout(() => {
    flushTimer = null;
    flushBatch();
  }, batchIntervalMs) as unknown as number;
};

const enqueueUpdate = (entityId: string, payload: ToriiPayload) => {
  const deletion = isDeletionPayload(payload);
  const existing = pending.get(entityId);

  if (existing) {
    if (deletion) {
      existing.payload = payload;
      existing.isDeletion = true;
    } else if (existing.isDeletion) {
      existing.payload = payload;
      existing.isDeletion = false;
    } else {
      existing.payload = mergeDeep(existing.payload, payload);
    }
  } else {
    pending.set(entityId, { payload, isDeletion: deletion });
    queue.push(entityId);
  }

  if (queue.length >= batchSize) {
    flushBatch();
  } else {
    scheduleFlush();
  }

  if (queue.length > warningThreshold) {
    post({
      type: "log",
      level: "warn",
      message: "sync-worker queue length high",
      context: { queueLength: queue.length, pending: pending.size },
    });
  }
};

const flushBatch = () => {
  if (queue.length === 0) {
    return;
  }

  const startedAt = performance.now();
  const upserts: ToriiPayload[] = [];
  const deletions: string[] = [];
  const processed = new Set<string>();

  while (queue.length > 0 && processed.size < batchSize) {
    const entityId = queue.shift();
    if (!entityId || processed.has(entityId)) {
      continue;
    }

    processed.add(entityId);
    const entry = pending.get(entityId);
    if (!entry) {
      continue;
    }
    pending.delete(entityId);

    if (entry.isDeletion) {
      deletions.push(entityId);
    } else {
      upserts.push(entry.payload);
    }
  }

  const elapsedMs = performance.now() - startedAt;
  post({
    type: "batch-ready",
    batchId: nextBatchId++,
    upserts,
    deletions,
    queueSize: queue.length,
    elapsedMs,
  });

  if (queue.length > 0) {
    scheduleFlush();
  }
};

const resetState = () => {
  pending.clear();
  queue.length = 0;
  if (flushTimer !== null) {
    ctx.clearTimeout(flushTimer);
    flushTimer = null;
  }
};

ctx.onmessage = (event: MessageEvent<InboundMessage>) => {
  const data = event.data;
  switch (data.type) {
    case "init": {
      batchSize = data.batchSize;
      batchIntervalMs = data.batchIntervalMs;
      warningThreshold = data.warningThreshold ?? warningThreshold;
      post({ type: "ready" });
      break;
    }
    case "torii-event": {
      enqueueUpdate(data.entityId, data.payload);
      break;
    }
    case "update-config": {
      if (typeof data.batchSize === "number") {
        batchSize = data.batchSize;
      }
      if (typeof data.batchIntervalMs === "number") {
        batchIntervalMs = data.batchIntervalMs;
      }
      if (typeof data.warningThreshold === "number") {
        warningThreshold = data.warningThreshold;
      }
      break;
    }
    case "cancel-all": {
      resetState();
      break;
    }
    default: {
      throw new Error("Unknown sync-worker message");
    }
  }
};
