import type { TerrainFogMask } from "./terrain-fog-mask";
import type { PreparedTerrainPage, TerrainPageRequest, TerrainShroudInstance } from "./terrain-types";

interface PendingTerrainPage {
  reject(error: Error): void;
  resolve(page: PreparedTerrainPage): void;
}

interface PendingTerrainFogMask {
  reject(error: Error): void;
  resolve(mask: TerrainFogMask | null): void;
}

interface TerrainPageWorkerResponse {
  error?: string;
  fogMask?: TerrainFogMask | null;
  id: number;
  kind: "fog-mask" | "terrain-page";
  page?: PreparedTerrainPage;
}

export class TerrainPageWorkerClient {
  private readonly pending = new Map<number, PendingTerrainPage>();
  private readonly pendingFogMasks = new Map<number, PendingTerrainFogMask>();
  private readonly worker: Worker;
  private nextId = 1;
  private disposed = false;

  constructor() {
    this.worker = new Worker(new URL("./terrain-page-worker.ts", import.meta.url), {
      name: "procedural-terrain-page-builder",
      type: "module",
    });
    this.worker.addEventListener("message", this.handleMessage);
    this.worker.addEventListener("error", this.handleWorkerError);
  }

  prepare(request: TerrainPageRequest): Promise<PreparedTerrainPage> {
    if (this.disposed) return Promise.reject(new Error("Terrain page worker has been disposed"));
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      this.worker.postMessage({ id, kind: "terrain-page", request });
    });
  }

  prepareFogMask(instances: readonly TerrainShroudInstance[]): Promise<TerrainFogMask | null> {
    if (this.disposed) return Promise.reject(new Error("Terrain page worker has been disposed"));
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pendingFogMasks.set(id, { reject, resolve });
      this.worker.postMessage({ id, instances, kind: "fog-mask" });
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.worker.removeEventListener("message", this.handleMessage);
    this.worker.removeEventListener("error", this.handleWorkerError);
    this.worker.terminate();
    this.rejectAll(new Error("Terrain page worker was disposed before completing pending work"));
  }

  private readonly handleMessage = (event: MessageEvent<TerrainPageWorkerResponse>) => {
    if (event.data.kind === "fog-mask") {
      this.resolveFogMaskResponse(event.data);
      return;
    }
    const pending = this.pending.get(event.data.id);
    if (!pending) return;
    this.pending.delete(event.data.id);
    if (event.data.error) {
      pending.reject(new Error(event.data.error));
      return;
    }
    if (!event.data.page) {
      pending.reject(new Error("Terrain page worker returned no page"));
      return;
    }
    pending.resolve(event.data.page);
  };

  private resolveFogMaskResponse(response: TerrainPageWorkerResponse): void {
    const pending = this.pendingFogMasks.get(response.id);
    if (!pending) return;
    this.pendingFogMasks.delete(response.id);
    if (response.error) {
      pending.reject(new Error(response.error));
      return;
    }
    pending.resolve(response.fogMask ?? null);
  }

  private readonly handleWorkerError = (event: ErrorEvent) => {
    this.rejectAll(new Error(event.message || "Terrain page worker failed"));
  };

  private rejectAll(error: Error): void {
    this.pending.forEach(({ reject }) => reject(error));
    this.pending.clear();
    this.pendingFogMasks.forEach(({ reject }) => reject(error));
    this.pendingFogMasks.clear();
  }
}
