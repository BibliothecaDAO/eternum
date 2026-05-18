import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { addToriiStreamBreadcrumb, reportToriiSubscriptionLifecycle } from "@/observability/network-health-reporting";
import type { ToriiHealthProbeResult, ToriiHealthUnreachableReason } from "./torii-health-probe";

const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 10_000;
const DEFAULT_STALE_THRESHOLD_MS = 15_000;
const DEFAULT_RECONNECT_COOLDOWN_MS = 60_000;
const DEFAULT_RECOVERY_TOAST_THRESHOLD_MS = 30_000;
const DEFAULT_DEAD_END_ATTEMPTS = 5;
const DEFAULT_TRANSIENT_HEALTH_FAILURE_THRESHOLD = 2;

interface ConnectionHealthMonitorConfig {
  onReconnectSpatial: () => Promise<void>;
  onReconnectGlobal: () => Promise<void>;
  onReconnectComplete?: () => void;
  healthCheckFn: () => Promise<ToriiHealthProbeResult>;
  onRecovery?: (outageMs: number, attempts: number) => void;
  onDeadEnd?: (outageMs: number, attempts: number, reason?: ToriiHealthUnreachableReason) => void;
  healthCheckIntervalMs?: number;
  staleThresholdMs?: number;
  reconnectCooldownMs?: number;
  recoveryToastThresholdMs?: number;
  deadEndAttempts?: number;
  transientHealthFailureThreshold?: number;
}

interface ConnectionHealthToriiInput {
  activeWorld?: { toriiBaseUrl?: string | null } | null;
  runtimeToriiUrl?: string | null;
  fallbackToriiUrl: string;
}

interface ToriiHeartbeatClient {
  onIndexerUpdated?: (contractAddress: string | null, callback: () => void) => Promise<{ cancel: () => void }>;
}

let activeMonitor: ConnectionHealthMonitor | null = null;

export const getConnectionHealthMonitor = (): ConnectionHealthMonitor | null => activeMonitor;

export async function subscribeToToriiHeartbeat(
  toriiClient: ToriiHeartbeatClient,
): Promise<{ cancel: () => void } | null> {
  if (typeof toriiClient.onIndexerUpdated !== "function") {
    return null;
  }

  try {
    const subscription = await toriiClient.onIndexerUpdated(null, () => {
      useConnectionStore.getState().recordToriiHeartbeat();
      addToriiStreamBreadcrumb({
        event: "heartbeat_received",
        streamType: "both",
      });
    });
    useConnectionStore.getState().markToriiHeartbeatAvailable();
    return subscription;
  } catch (error) {
    console.warn("[ConnectionHealthMonitor] Failed to subscribe to Torii heartbeat", error);
    return null;
  }
}

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
  private readonly transientHealthFailureThreshold: number;
  private consecutiveTransientHealthFailures = 0;

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
    this.transientHealthFailureThreshold =
      config.transientHealthFailureThreshold ?? DEFAULT_TRANSIENT_HEALTH_FAILURE_THRESHOLD;
  }

  start(): void {
    if (this.disposed) return;

    activeMonitor = this;
    this.startedAtMs = Date.now();
    this.hasObservedHealthyStreams = this.haveObservedStreamHandshakes(useConnectionStore.getState());
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("pageshow", this.handlePageShow);
    this.startHealthCheckLoop();
  }

  stop(): void {
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("pageshow", this.handlePageShow);
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
    this.consecutiveTransientHealthFailures = 0;
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

    if (this.isHeartbeatStale(store)) {
      void this.reconnectStaleStreams(true, true);
    }
  };

  private handleOnline = (): void => {
    if (this.disposed) return;
    if (!this.hasObservedHealthyStreams) return;

    useConnectionStore.getState().resetReconnectAttempts();
    void this.reconnectStaleStreams(true, true);
  };

  private handlePageShow = (): void => {
    if (this.disposed) return;
    void this.runHealthCheck();
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

    try {
      this.applyHealthProbeResult(await this.config.healthCheckFn());
    } catch {
      this.applyHealthProbeResult({ status: "unreachable", reason: "network_error" });
    }
  }

  // --- Shared reconnect logic ---

  private applyHealthProbeResult(result: ToriiHealthProbeResult): void {
    if (result.status === "reachable") {
      this.markHealthCheckPassed();
      return;
    }

    if (result.reason === "endpoint_not_found") {
      this.markEndpointNotFound();
      return;
    }

    this.markTransientHealthCheckFailed(result.reason);
  }

  private markHealthCheckPassed(): void {
    const store = useConnectionStore.getState();
    store.recordHealthCheck();
    this.consecutiveTransientHealthFailures = 0;
    this.markConnectedIfNeeded();
    store.resetReconnectAttempts();

    if (!this.hasObservedHealthyStreams) {
      this.hasObservedHealthyStreams = this.haveStreamsTickedSinceStart(store);
      if (!this.hasObservedHealthyStreams) return;
    }

    this.reconnectSilentStreamsAfterCooldown(store);
  }

  private markTransientHealthCheckFailed(reason: ToriiHealthUnreachableReason): void {
    this.consecutiveTransientHealthFailures += 1;
    if (this.consecutiveTransientHealthFailures < this.transientHealthFailureThreshold) {
      return;
    }

    this.reconnectAfterFailedHealthCheck(reason);
  }

  private markEndpointNotFound(): void {
    if (this.deadEndReported) {
      return;
    }

    this.consecutiveTransientHealthFailures = 0;
    const store = useConnectionStore.getState();
    store.setStatus("disconnected");
    store.setSpatialStatus("failed");
    store.setGlobalStatus("failed");
    store.incrementReconnectAttempts();
    this.markOutageStart();
    this.reportDeadEnd("endpoint_not_found");
  }

  private haveObservedStreamHandshakes(store: ReturnType<typeof useConnectionStore.getState>): boolean {
    return store.lastSpatialHandshake > 0 && store.lastGlobalHandshake > 0;
  }

  private haveStreamsTickedSinceStart(store: ReturnType<typeof useConnectionStore.getState>): boolean {
    const lastSpatialActivity = Math.max(store.lastSpatialHandshake, store.lastSpatialUpdate);
    const lastGlobalActivity = Math.max(store.lastGlobalHandshake, store.lastGlobalUpdate);
    return lastSpatialActivity > this.startedAtMs && lastGlobalActivity > this.startedAtMs;
  }

  private reconnectSilentStreamsAfterCooldown(store: ReturnType<typeof useConnectionStore.getState>): void {
    const now = Date.now();
    if (now - this.lastStreamReconnectAtMs < this.reconnectCooldownMs) return;

    if (!this.isHeartbeatStale(store)) return;

    reportToriiSubscriptionLifecycle({
      streamType: "both",
      kind: "heartbeat",
      outcome: "stale",
      durationMs: now - store.lastToriiHeartbeat,
    });
    this.lastStreamReconnectAtMs = now;
    void this.reconnectStaleStreams(true, true);
  }

  private reconnectAfterFailedHealthCheck(reason: ToriiHealthUnreachableReason): void {
    const now = Date.now();
    if (now - this.lastStreamReconnectAtMs < this.reconnectCooldownMs) return;

    const store = useConnectionStore.getState();
    store.setStatus("disconnected");
    store.setSpatialStatus("failed");
    store.setGlobalStatus("failed");
    store.incrementReconnectAttempts();
    this.markOutageStart();
    this.reportDeadEndIfNeeded(reason);

    this.lastStreamReconnectAtMs = now;
    void this.reconnectStaleStreams(true, true, { attemptAlreadyCounted: true, deadEndReason: reason });
  }

  private isHeartbeatStale(store: ReturnType<typeof useConnectionStore.getState>): boolean {
    return store.toriiHeartbeatAvailable && Date.now() - store.lastToriiHeartbeat > this.staleThresholdMs;
  }

  private async reconnectStaleStreams(
    spatial: boolean,
    global: boolean,
    options: {
      markConnectedOnSuccess?: boolean;
      attemptAlreadyCounted?: boolean;
      deadEndReason?: ToriiHealthUnreachableReason;
    } = {},
  ): Promise<void> {
    if (this.reconnecting || this.disposed) return;

    const markConnectedOnSuccess = options.markConnectedOnSuccess ?? true;
    this.reconnecting = true;
    const store = useConnectionStore.getState();
    if (spatial) store.setSpatialStatus("reconnecting");
    if (global) store.setGlobalStatus("reconnecting");
    let attempted = false;
    try {
      const promises: Promise<void>[] = [];
      if (spatial) promises.push(this.config.onReconnectSpatial());
      if (global) promises.push(this.config.onReconnectGlobal());
      attempted = promises.length > 0;
      await Promise.all(promises);
      if (attempted) {
        this.config.onReconnectComplete?.();
      }
      if (markConnectedOnSuccess) {
        if (spatial) store.setSpatialStatus("connected");
        if (global) store.setGlobalStatus("connected");
        if (attempted) {
          this.markConnectedIfNeeded();
        }
      } else {
        if (spatial) store.setSpatialStatus("failed");
        if (global) store.setGlobalStatus("failed");
      }
    } catch (error) {
      console.warn("[ConnectionHealthMonitor] Failed to reconnect stale streams", error);
      store.setStatus("degraded");
      if (spatial) store.setSpatialStatus("failed");
      if (global) store.setGlobalStatus("failed");
      if (!options.attemptAlreadyCounted) {
        store.incrementReconnectAttempts();
      }
      this.markOutageStart();
      this.reportDeadEndIfNeeded(options.deadEndReason);
    } finally {
      // Bump on both success and failure: scoped subscribers (e.g. player
      // structure sync) re-mount on this version, and a failed global
      // reconnect can leave their per-stream subscriptions wedged on the
      // old client. Letting them retry independently is the recovery path
      // when the global fan-out keeps timing out.
      if (attempted) {
        store.recordStreamReconnect();
      }
      this.reconnecting = false;
    }
  }

  private reportDeadEndIfNeeded(reason?: ToriiHealthUnreachableReason): void {
    if (this.deadEndReported) return;
    const store = useConnectionStore.getState();
    if (store.reconnectAttempts < this.deadEndAttempts) return;
    this.reportDeadEnd(reason);
  }

  private reportDeadEnd(reason?: ToriiHealthUnreachableReason): void {
    if (this.deadEndReported) return;
    const store = useConnectionStore.getState();
    this.deadEndReported = true;
    const outageMs = this.pendingRecoveryToastFromMs !== null ? Date.now() - this.pendingRecoveryToastFromMs : 0;
    this.config.onDeadEnd?.(outageMs, store.reconnectAttempts, reason);
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
