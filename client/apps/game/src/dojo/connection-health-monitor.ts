import { useConnectionStore } from "@/hooks/store/use-connection-store";

const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 10_000;
const DEFAULT_STALE_THRESHOLD_MS = 15_000;
const DEFAULT_RECONNECT_COOLDOWN_MS = 60_000;
const DEFAULT_RECOVERY_TOAST_THRESHOLD_MS = 30_000;
const DEFAULT_DEAD_END_ATTEMPTS = 5;

interface ConnectionHealthMonitorConfig {
  onReconnectSpatial: () => Promise<void>;
  onReconnectGlobal: () => Promise<void>;
  healthCheckFn: () => Promise<boolean>;
  onRecovery?: (outageMs: number, attempts: number) => void;
  onDeadEnd?: (outageMs: number, attempts: number) => void;
  healthCheckIntervalMs?: number;
  staleThresholdMs?: number;
  reconnectCooldownMs?: number;
  recoveryToastThresholdMs?: number;
  deadEndAttempts?: number;
}

interface ConnectionHealthToriiInput {
  activeWorld?: { toriiBaseUrl?: string | null } | null;
  runtimeToriiUrl?: string | null;
  fallbackToriiUrl: string;
}

let activeMonitor: ConnectionHealthMonitor | null = null;

export const getConnectionHealthMonitor = (): ConnectionHealthMonitor | null => activeMonitor;

export class ConnectionHealthMonitor {
  private readonly config: ConnectionHealthMonitorConfig;
  private readonly healthCheckIntervalMs: number;
  private readonly staleThresholdMs: number;
  private readonly reconnectCooldownMs: number;
  private readonly recoveryToastThresholdMs: number;

  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private reconnecting = false;
  private disposed = false;
  private lastStreamReconnectAtMs = 0;
  private pendingRecoveryToastFromMs: number | null = null;
  private deadEndReported = false;
  private startedAtMs = 0;
  private hasObservedHealthyStreams = false;
  private readonly deadEndAttempts: number;

  constructor(config: ConnectionHealthMonitorConfig) {
    this.config = config;
    this.healthCheckIntervalMs = config.healthCheckIntervalMs ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS;
    this.staleThresholdMs = config.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS;
    this.reconnectCooldownMs = Math.max(
      config.reconnectCooldownMs ?? DEFAULT_RECONNECT_COOLDOWN_MS,
      this.staleThresholdMs,
    );
    this.recoveryToastThresholdMs = config.recoveryToastThresholdMs ?? DEFAULT_RECOVERY_TOAST_THRESHOLD_MS;
    this.deadEndAttempts = config.deadEndAttempts ?? DEFAULT_DEAD_END_ATTEMPTS;
  }

  start(): void {
    if (this.disposed) return;

    activeMonitor = this;
    this.startedAtMs = Date.now();
    this.hasObservedHealthyStreams = false;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("online", this.handleOnline);
    this.startHealthCheckLoop();
  }

  stop(): void {
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("online", this.handleOnline);
    this.stopHealthCheckLoop();
    if (activeMonitor === this) activeMonitor = null;
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
  }

  /** Bypasses the reconnect cooldown and boot grace — used by the UI retry button. */
  async forceReconnect(): Promise<void> {
    if (this.disposed) return;
    this.lastStreamReconnectAtMs = Date.now();
    this.hasObservedHealthyStreams = true;
    await this.reconnectStaleStreams(true, true);
  }

  /** Test-only: skip the boot grace period so tests can exercise steady-state staleness. */
  exitBootGraceForTests(): void {
    this.hasObservedHealthyStreams = true;
  }

  // --- Phase 3: Visibility & Online Handlers ---

  private handleVisibilityChange = (): void => {
    if (this.disposed) return;
    if (document.visibilityState !== "visible") return;
    if (!this.hasObservedHealthyStreams) return;

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
    if (!this.hasObservedHealthyStreams) return;

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

    try {
      const healthy = await this.config.healthCheckFn();

      if (healthy) {
        store.recordHealthCheck();
        this.markConnectedIfNeeded();
        store.resetReconnectAttempts();

        // Boot grace: only consider streams stale once we've seen both tick
        // at least once *after* the monitor started. Until then, a quiet
        // subscription could just be mid-handshake — don't cancel it.
        if (!this.hasObservedHealthyStreams) {
          if (store.lastSpatialUpdate > this.startedAtMs && store.lastGlobalUpdate > this.startedAtMs) {
            this.hasObservedHealthyStreams = true;
          } else {
            return;
          }
        }

        // Server is reachable, but a stream can silently die (WASM gRPC drop
        // without onError firing) while the tab stays visible. If either stream
        // has been silent past the stale threshold, force a resubscribe.
        // Cooldown prevents reconnect storms when the area is genuinely idle.
        const now = Date.now();
        if (now - this.lastStreamReconnectAtMs >= this.reconnectCooldownMs) {
          const spatialStale = now - store.lastSpatialUpdate > this.staleThresholdMs;
          const globalStale = now - store.lastGlobalUpdate > this.staleThresholdMs;
          if (spatialStale || globalStale) {
            this.lastStreamReconnectAtMs = now;
            void this.reconnectStaleStreams(spatialStale, globalStale);
          }
        }
      }
    } catch {
      store.setStatus("disconnected");
      store.setSpatialStatus("failed");
      store.setGlobalStatus("failed");
      store.incrementReconnectAttempts();
      this.markOutageStart();
      this.reportDeadEndIfNeeded();
    }
  }

  // --- Shared reconnect logic ---

  private async reconnectStaleStreams(spatial: boolean, global: boolean): Promise<void> {
    if (this.reconnecting || this.disposed) return;

    this.reconnecting = true;
    const store = useConnectionStore.getState();
    if (spatial) store.setSpatialStatus("reconnecting");
    if (global) store.setGlobalStatus("reconnecting");
    try {
      const promises: Promise<void>[] = [];
      if (spatial) promises.push(this.config.onReconnectSpatial());
      if (global) promises.push(this.config.onReconnectGlobal());
      await Promise.all(promises);
      if (spatial) store.setSpatialStatus("connected");
      if (global) store.setGlobalStatus("connected");
      if (promises.length > 0) {
        store.recordStreamReconnect();
        this.markConnectedIfNeeded();
      }
    } catch (error) {
      console.warn("[ConnectionHealthMonitor] Failed to reconnect stale streams", error);
      store.setStatus("degraded");
      if (spatial) store.setSpatialStatus("failed");
      if (global) store.setGlobalStatus("failed");
      store.incrementReconnectAttempts();
      this.markOutageStart();
      this.reportDeadEndIfNeeded();
    } finally {
      this.reconnecting = false;
    }
  }

  private reportDeadEndIfNeeded(): void {
    if (this.deadEndReported) return;
    const store = useConnectionStore.getState();
    if (store.reconnectAttempts < this.deadEndAttempts) return;
    this.deadEndReported = true;
    const outageMs = this.pendingRecoveryToastFromMs !== null ? Date.now() - this.pendingRecoveryToastFromMs : 0;
    this.config.onDeadEnd?.(outageMs, store.reconnectAttempts);
  }

  private markOutageStart(): void {
    if (this.pendingRecoveryToastFromMs === null) {
      const store = useConnectionStore.getState();
      this.pendingRecoveryToastFromMs = store.lastDisconnectedAt ?? Date.now();
    }
  }

  private markConnectedIfNeeded(): void {
    const store = useConnectionStore.getState();
    const wasDown = store.status !== "connected" || this.pendingRecoveryToastFromMs !== null;
    const attemptsBeforeReset = store.reconnectAttempts;
    store.setStatus("connected");

    if (this.pendingRecoveryToastFromMs !== null) {
      const outageMs = Date.now() - this.pendingRecoveryToastFromMs;
      this.pendingRecoveryToastFromMs = null;
      this.deadEndReported = false;
      if (wasDown && outageMs >= this.recoveryToastThresholdMs) {
        this.config.onRecovery?.(outageMs, attemptsBeforeReset);
      }
    }
  }
}

const trimOptionalUrl = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const resolveConnectionHealthToriiBaseUrl = ({
  activeWorld,
  fallbackToriiUrl,
  runtimeToriiUrl,
}: ConnectionHealthToriiInput): string =>
  trimOptionalUrl(activeWorld?.toriiBaseUrl) ?? trimOptionalUrl(runtimeToriiUrl) ?? fallbackToriiUrl;
