import type { Entity } from "@dojoengine/torii-wasm";

export type SyncWorkerBatch = {
  batchId: number;
  upserts: Entity[];
  deletions: string[];
  queueSize: number;
  elapsedMs: number;
};

type WorkerReadyMessage = { type: "ready" };
type WorkerBatchReadyMessage = SyncWorkerBatch & { type: "batch-ready" };
type WorkerLogMessage = { type: "log"; level: "info" | "warn"; message: string; context?: Record<string, unknown> };
type WorkerErrorMessage = { type: "error"; message: string; entityId?: string };

type WorkerMessage = WorkerReadyMessage | WorkerBatchReadyMessage | WorkerLogMessage | WorkerErrorMessage;

export interface ToriiSyncWorkerOptions {
  batchSize?: number;
  batchIntervalMs?: number;
  warningThreshold?: number;
  logging?: boolean;
  onBatch?: (batch: SyncWorkerBatch) => void;
  onError?: (message: string, error?: unknown) => void;
  onLog?: (level: "info" | "warn", message: string, context?: Record<string, unknown>) => void;
}

export class ToriiSyncWorkerManager {
  private worker: Worker | null = null;
  private ready = false;
  private disposed = false;

  constructor(private readonly options: ToriiSyncWorkerOptions = {}) {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      return;
    }

    try {
      this.worker = new Worker(new URL("./workers/sync-worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (event) => this.handleMessage(event.data as WorkerMessage);
      this.worker.onerror = (event) => {
        if (this.options.onError) {
          this.options.onError("sync-worker runtime error", event.error ?? event.message);
        } else {
          console.error("[sync-worker] runtime error", event.message, event.error);
        }
      };
      this.worker.postMessage({
        type: "init",
        schemaVersion: 1,
        batchSize: this.options.batchSize ?? 25,
        batchIntervalMs: this.options.batchIntervalMs ?? 50,
        warningThreshold: this.options.warningThreshold ?? 500,
      });
    } catch (error) {
      this.worker = null;
      this.options.onError?.("Failed to initialize sync-worker", error);
      console.error("[sync-worker] initialization failed", error);
    }
  }

  public get isAvailable() {
    return Boolean(this.worker) && !this.disposed;
  }

  public enqueue(payload: Entity, origin: "entity" | "event") {
    if (!this.worker || !this.ready || this.disposed) {
      return false;
    }

    this.worker.postMessage({
      type: "torii-event",
      entityId: payload.hashed_keys,
      payload,
      origin,
    });

    return true;
  }

  public updateConfig(params: { batchSize?: number; batchIntervalMs?: number; warningThreshold?: number }) {
    if (!this.worker || !this.ready || this.disposed) {
      return;
    }
    this.worker.postMessage({ type: "update-config", ...params });
  }

  public dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.worker) {
      this.worker.postMessage({ type: "cancel-all" });
      this.worker.terminate();
      this.worker = null;
    }
  }

  private handleMessage(message: WorkerMessage) {
    switch (message.type) {
      case "ready":
        this.ready = true;
        break;
      case "batch-ready":
        if (import.meta.env.DEV) {
          console.log(
            "[sync-worker] batch",
            message.batchId,
            "upserts",
            message.upserts.length,
            "deletions",
            message.deletions.length,
            "queue",
            message.queueSize,
            "elapsed",
            `${message.elapsedMs.toFixed(2)}ms`,
          );
        }
        this.options.onBatch?.({
          batchId: message.batchId,
          upserts: message.upserts,
          deletions: message.deletions,
          queueSize: message.queueSize,
          elapsedMs: message.elapsedMs,
        });
        break;
      case "log":
        if (this.options.logging) {
          if (this.options.onLog) {
            this.options.onLog(message.level, message.message, message.context);
          } else {
            console[message.level === "warn" ? "warn" : "log"]("[sync-worker]", message.message, message.context);
          }
        }
        break;
      case "error":
        if (this.options.onError) {
          this.options.onError(message.message, message.entityId);
        } else {
          console.error("[sync-worker] error", message.message, message.entityId);
        }
        break;
      default:
        throw new Error("Unhandled worker message type");
    }
  }
}
