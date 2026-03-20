import { useConnectionStore } from "@/hooks/store/use-connection-store";

const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 15_000;
const DEFAULT_STALE_THRESHOLD_MS = 30_000;

interface ConnectionHealthMonitorConfig {
  onReconnectSpatial: () => Promise<void>;
  onReconnectGlobal: () => Promise<void>;
  healthCheckFn: () => Promise<boolean>;
  healthCheckIntervalMs?: number;
  staleThresholdMs?: number;
}

export class ConnectionHealthMonitor {
  private readonly config: ConnectionHealthMonitorConfig;
  private readonly healthCheckIntervalMs: number;
  private readonly staleThresholdMs: number;

  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private reconnecting = false;
  private disposed = false;

  constructor(config: ConnectionHealthMonitorConfig) {
    this.config = config;
    this.healthCheckIntervalMs = config.healthCheckIntervalMs ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS;
    this.staleThresholdMs = config.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS;
  }

  start(): void {
    if (this.disposed) return;

    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("online", this.handleOnline);
    this.startHealthCheckLoop();
  }

  stop(): void {
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("online", this.handleOnline);
    this.stopHealthCheckLoop();
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
  }

  // --- Phase 3: Visibility & Online Handlers ---

  private handleVisibilityChange = (): void => {
    if (this.disposed) return;
    if (document.visibilityState !== "visible") return;

    const store = useConnectionStore.getState();
    const now = Date.now();
    const spatialStale = now - store.lastSpatialUpdate > this.staleThresholdMs;
    const globalStale = now - store.lastGlobalUpdate > this.staleThresholdMs;

    if (spatialStale || globalStale) {
      void this.reconnectStaleStreams(spatialStale, globalStale);
    }
  };

  private handleOnline = (): void => {
    if (this.disposed) return;

    useConnectionStore.getState().resetReconnectAttempts();
    void this.reconnectStaleStreams(true, true);
  };

  // --- Phase 4: Health Polling ---

  private startHealthCheckLoop(): void {
    this.healthCheckTimer = setInterval(() => {
      void this.runHealthCheck();
    }, this.healthCheckIntervalMs);
  }

  private stopHealthCheckLoop(): void {
    if (this.healthCheckTimer !== null) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private async runHealthCheck(): Promise<void> {
    if (this.disposed) return;

    // Skip polling if tab is hidden to save resources
    if (document.visibilityState === "hidden") return;

    const store = useConnectionStore.getState();
    const now = Date.now();

    try {
      const healthy = await this.config.healthCheckFn();

      if (healthy) {
        store.recordHealthCheck();
        // Server is reachable — connection is healthy.
        // Stream staleness just means no game state changed recently, not a connection issue.
        store.setStatus("connected");
        store.resetReconnectAttempts();
      }
    } catch {
      store.setStatus("disconnected");
      store.incrementReconnectAttempts();
    }
  }

  // --- Shared reconnect logic ---

  private async reconnectStaleStreams(spatial: boolean, global: boolean): Promise<void> {
    if (this.reconnecting || this.disposed) return;

    this.reconnecting = true;
    try {
      const promises: Promise<void>[] = [];
      if (spatial) promises.push(this.config.onReconnectSpatial());
      if (global) promises.push(this.config.onReconnectGlobal());
      await Promise.all(promises);
    } finally {
      this.reconnecting = false;
    }
  }
}
