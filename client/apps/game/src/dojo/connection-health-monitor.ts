import { useConnectionStore, type ConnectionStatus } from "@/hooks/store/use-connection-store";
import { addToriiStreamBreadcrumb, reportToriiSubscriptionLifecycle } from "@/observability/network-health-reporting";
import { appendConsoleFields } from "@/utils/console-message";
import {
  classifyDisconnect,
  type DisconnectClassification,
  type DisconnectSignalSnapshot,
  type HealthProbeSignal,
  type ServerAvailabilityVerdict,
} from "./connection-disconnect-classification";
import { observeToriiStreamLifecycle } from "./torii-stream-lifecycle-observer";
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
  /** Phase 2: independent server-side reachability for the active world. */
  getServerAvailability?: () => Promise<ServerAvailabilityVerdict>;
  /** Fired once per outage (connected -> not-connected) with the LOCAL/REMOTE verdict. */
  onDisconnectClassified?: (classification: DisconnectClassification, snapshot: DisconnectSignalSnapshot) => void;
  healthCheckIntervalMs?: number;
  staleThresholdMs?: number;
  reconnectCooldownMs?: number;
  recoveryToastThresholdMs?: number;
  deadEndAttempts?: number;
  transientHealthFailureThreshold?: number;
  /**
   * Cadence of a lightweight heartbeat watchdog that catches staleness between
   * the slower HTTP probes. Omit/0 to disable (probe-driven detection only).
   */
  heartbeatWatchdogIntervalMs?: number;
  /**
   * Adaptive reconnect backoff: first retry waits min, then doubles up to max.
   * When either is omitted, the flat `reconnectCooldownMs` is used (legacy).
   */
  minReconnectCooldownMs?: number;
  maxReconnectCooldownMs?: number;
  /**
   * Last-resort refresh cadence for deployments without indexer heartbeat.
   * Omit/0 to disable.
   */
  quietStreamRefreshMs?: number;
}

export type ConnectionRecoveryRequest =
  | { kind: "force_retry" }
  | { kind: "visibility_resume" }
  | { kind: "online_event" }
  | { kind: "heartbeat_stale" }
  | { kind: "quiet_stream_fallback" }
  | { kind: "health_probe_failure"; reason: ToriiHealthUnreachableReason }
  | { kind: "stream_close"; stream: "entity" | "event"; reason: string };

const formatConnectionRecoveryRequest = (request: ConnectionRecoveryRequest): string =>
  appendConsoleFields("[ConnectionHealthMonitor] recovery requested", {
    kind: request.kind,
    stream: request.kind === "stream_close" ? request.stream : undefined,
    reason: request.kind === "stream_close" || request.kind === "health_probe_failure" ? request.reason : undefined,
  });

interface ConnectionHealthToriiInput {
  activeWorld?: { toriiBaseUrl?: string | null } | null;
  runtimeToriiUrl?: string | null;
  fallbackToriiUrl: string;
}

interface ToriiHeartbeatClient {
  onIndexerUpdated?: (contractAddress: string | null, callback: () => void) => Promise<{ cancel: () => void }>;
}

let activeMonitor: ConnectionHealthMonitor | null = null;
let pendingRecoveryRequest: ConnectionRecoveryRequest | null = null;

export const getConnectionHealthMonitor = (): ConnectionHealthMonitor | null => activeMonitor;

export const requestConnectionRecovery = (request: ConnectionRecoveryRequest): void => {
  if (activeMonitor) {
    void activeMonitor.requestRecovery(request);
    return;
  }

  pendingRecoveryRequest = request;
  if (request.kind === "stream_close") {
    useConnectionStore.getState().recordStreamClose();
  }
  console.warn("[ConnectionHealthMonitor] recovery requested before the monitor was active", request);
};

const GRPC_STATUS_UNIMPLEMENTED = "12";

// Torii 1.8 answers SubscribeIndexer with a trailers-only UNIMPLEMENTED
// response; the dojo.js 1.7 wasm client reads that as a dropped stream and
// resubscribes forever. Probe the RPC once so unsupported servers skip the
// heartbeat entirely — support self-heals once the server gains the RPC.
export async function probeIndexerHeartbeatSupport(toriiBaseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${toriiBaseUrl.replace(/\/+$/, "")}/world.World/SubscribeIndexer`, {
      method: "POST",
      headers: { "content-type": "application/grpc-web+proto", "x-grpc-web": "1" },
      body: new Uint8Array(5),
    });
    const unsupported = response.headers.get("grpc-status") === GRPC_STATUS_UNIMPLEMENTED;
    void response.body?.cancel().catch(() => {});
    return !unsupported;
  } catch {
    // A transport failure says nothing about support; let the real subscription try.
    return true;
  }
}

export async function subscribeToToriiHeartbeat(
  toriiClient: ToriiHeartbeatClient,
  toriiBaseUrl?: string,
): Promise<{ cancel: () => void } | null> {
  if (typeof toriiClient.onIndexerUpdated !== "function") {
    return null;
  }

  if (toriiBaseUrl && !(await probeIndexerHeartbeatSupport(toriiBaseUrl))) {
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
    // Availability flips inside recordToriiHeartbeat on the FIRST real beat.
    // Marking it here on subscribe alone is wrong against servers where
    // SubscribeIndexer is UNIMPLEMENTED (upstream torii 1.8 vs dojo.js 1.7
    // clients): the call resolves, no beat ever arrives, and the staleness
    // watchdog turns into a permanent reconnect loop for every stream.
    // Best-effort: if the SDK ever surfaces a real close/error on the heartbeat
    // stream, record it so the next outage is classified REMOTE. No-op today.
    const detachLifecycle = observeToriiStreamLifecycle(subscription, () => {
      useConnectionStore.getState().recordStreamClose();
    });
    return {
      cancel: () => {
        detachLifecycle();
        subscription.cancel();
      },
    };
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
  private readonly heartbeatWatchdogIntervalMs: number | null;
  private readonly minReconnectCooldownMs: number | null;
  private readonly maxReconnectCooldownMs: number | null;
  private readonly quietStreamRefreshMs: number;

  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatWatchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastProactiveRefreshAtMs = 0;
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
  private lastHealthProbeResult: ToriiHealthProbeResult | null = null;
  private unsubscribeStore: (() => void) | null = null;
  // Monotonic token: bumped on every connected<->outage edge so an in-flight
  // async classification can detect that its outage already recovered.
  private classifyGeneration = 0;

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
    this.heartbeatWatchdogIntervalMs = config.heartbeatWatchdogIntervalMs ?? null;
    this.minReconnectCooldownMs = config.minReconnectCooldownMs ?? null;
    this.maxReconnectCooldownMs = config.maxReconnectCooldownMs ?? null;
    this.quietStreamRefreshMs = config.quietStreamRefreshMs ?? 0;
  }

  start(): void {
    if (this.disposed) return;

    activeMonitor = this;
    this.startedAtMs = Date.now();
    this.hasObservedHealthyStreams = this.haveObservedStreamHandshakes(useConnectionStore.getState());
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    window.addEventListener("pageshow", this.handlePageShow);
    // Classify every outage at the exact moment overall status leaves "connected"
    // — the same edge that drives the "Disconnected from the realm" banner.
    this.unsubscribeStore = useConnectionStore.subscribe((state, previous) => {
      this.handleStatusTransition(state.status, previous.status);
    });
    this.startHealthCheckLoop();
    this.startHeartbeatWatchdog();
    if (pendingRecoveryRequest) {
      const request = pendingRecoveryRequest;
      pendingRecoveryRequest = null;
      void this.requestRecovery(request);
    }
  }

  stop(): void {
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    window.removeEventListener("pageshow", this.handlePageShow);
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    this.stopHealthCheckLoop();
    this.stopHeartbeatWatchdog();
    if (activeMonitor === this) activeMonitor = null;
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
  }

  /** Bypasses the reconnect cooldown and boot grace — used by the UI retry button. */
  async forceReconnect(): Promise<void> {
    await this.requestRecovery({ kind: "force_retry" });
  }

  async requestRecovery(request: ConnectionRecoveryRequest): Promise<void> {
    if (this.disposed) return;

    console.warn(formatConnectionRecoveryRequest(request));
    if (request.kind === "quiet_stream_fallback") {
      await this.silentRefreshStreams();
      return;
    }

    const store = useConnectionStore.getState();
    if (request.kind === "stream_close") {
      store.recordStreamClose();
      store.setSpatialStatus("stale");
      store.setGlobalStatus("stale");
    }
    if (["force_retry", "visibility_resume", "online_event", "stream_close"].includes(request.kind)) {
      this.lastStreamReconnectAtMs = Date.now();
      this.hasObservedHealthyStreams = true;
    }
    if (request.kind === "force_retry") {
      this.consecutiveTransientHealthFailures = 0;
    }

    await this.reconnectStaleStreams(true, true, {
      attemptAlreadyCounted: request.kind === "health_probe_failure",
      deadEndReason: request.kind === "health_probe_failure" ? request.reason : undefined,
    });
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
      void this.requestRecovery({ kind: "visibility_resume" });
    }
  };

  private handleOnline = (): void => {
    if (this.disposed) return;
    useConnectionStore.getState().recordOnline();
    if (!this.hasObservedHealthyStreams) return;

    void this.requestRecovery({ kind: "online_event" });
  };

  // A local network drop: record it so a subsequent outage is classified LOCAL.
  // No reconnect attempt here — the OS is offline, so the `online` event drives
  // recovery. This is the LOCAL signal the monitor previously could not see.
  private handleOffline = (): void => {
    if (this.disposed) return;
    useConnectionStore.getState().recordOffline();
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

  // --- Heartbeat watchdog + heartbeat-unavailable fallback ---

  private startHeartbeatWatchdog(): void {
    if (this.heartbeatWatchdogIntervalMs === null || this.heartbeatWatchdogIntervalMs <= 0) return;
    this.heartbeatWatchdogTimer = setInterval(() => {
      this.runHeartbeatWatchdog();
    }, this.heartbeatWatchdogIntervalMs);
  }

  private stopHeartbeatWatchdog(): void {
    if (this.heartbeatWatchdogTimer !== null) {
      clearInterval(this.heartbeatWatchdogTimer);
      this.heartbeatWatchdogTimer = null;
    }
  }

  private runHeartbeatWatchdog(): void {
    if (this.disposed) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (!this.hasObservedHealthyStreams) return;

    const store = useConnectionStore.getState();
    // Catch a silently-dropped stream within a watchdog tick rather than waiting
    // for the next (slower) HTTP probe. Reuses the cooldown-gated reconnect path.
    this.reconnectSilentStreamsAfterCooldown(store);
    // Cancel-only streams need a fallback where SubscribeIndexer is unavailable.
    void this.maybeProactivelyRefreshQuietStreams();
  }

  private async maybeProactivelyRefreshQuietStreams(): Promise<void> {
    if (this.quietStreamRefreshMs <= 0 || this.reconnecting) return;

    const store = useConnectionStore.getState();
    if (store.toriiHeartbeatAvailable) return;
    // Only refresh a healthy, quiet connection; a real outage uses the normal path.
    if (store.status !== "connected") return;

    const now = Date.now();
    const lastActivity = Math.max(
      store.lastGlobalDataUpdate,
      store.lastSpatialDataUpdate,
      store.lastGlobalHandshake,
      store.lastSpatialHandshake,
    );
    if (now - lastActivity < this.quietStreamRefreshMs) return;
    if (now - this.lastProactiveRefreshAtMs < this.quietStreamRefreshMs) return;

    this.lastProactiveRefreshAtMs = now;
    this.lastStreamReconnectAtMs = now;
    await this.requestRecovery({ kind: "quiet_stream_fallback" });
  }

  // Re-open the streams WITHOUT flipping connection status: a proactive refresh
  // is maintenance, not an outage, so it must not show the banner or emit a
  // disconnect classification. A failure is swallowed — the heartbeat/health
  // path will detect and surface a genuine problem.
  private async silentRefreshStreams(): Promise<void> {
    if (this.reconnecting || this.disposed) return;
    this.reconnecting = true;
    try {
      await Promise.all([this.config.onReconnectSpatial(), this.config.onReconnectGlobal()]);
      this.config.onReconnectComplete?.();
      useConnectionStore.getState().recordStreamReconnect();
    } catch (error) {
      console.warn("[ConnectionHealthMonitor] Proactive stream refresh failed", error);
    } finally {
      this.reconnecting = false;
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
    // Remembered so disconnect classification can read the latest probe verdict.
    this.lastHealthProbeResult = result;
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

    if (!this.hasObservedHealthyStreams) {
      this.hasObservedHealthyStreams = this.haveStreamsTickedSinceStart(store);
      if (!this.hasObservedHealthyStreams) return;
    }

    const currentStore = useConnectionStore.getState();
    if (this.haveStreamsRecovered(currentStore)) {
      this.markConnectedIfNeeded();
      currentStore.resetReconnectAttempts();
    }

    this.reconnectSilentStreamsAfterCooldown(currentStore);
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

  // Time to wait before the next reconnect attempt. With min/max configured this
  // is fast-first exponential backoff (min, 2x, 4x… capped at max) keyed on the
  // consecutive-failure count, so a transient drop recovers in ~min while a
  // genuinely-down server still backs off. Falls back to the flat cooldown.
  private currentReconnectCooldownMs(): number {
    if (this.minReconnectCooldownMs === null || this.maxReconnectCooldownMs === null) {
      return this.reconnectCooldownMs;
    }
    const attempts = useConnectionStore.getState().reconnectAttempts;
    const scaled = this.minReconnectCooldownMs * 2 ** Math.max(0, attempts);
    return Math.min(this.maxReconnectCooldownMs, Math.max(this.minReconnectCooldownMs, scaled));
  }

  private reconnectSilentStreamsAfterCooldown(store: ReturnType<typeof useConnectionStore.getState>): void {
    const now = Date.now();
    if (now - this.lastStreamReconnectAtMs < this.currentReconnectCooldownMs()) return;

    if (!this.isHeartbeatStale(store)) return;

    reportToriiSubscriptionLifecycle({
      streamType: "both",
      kind: "heartbeat",
      outcome: "stale",
      durationMs: now - store.lastToriiHeartbeat,
    });
    this.lastStreamReconnectAtMs = now;
    void this.requestRecovery({ kind: "heartbeat_stale" });
  }

  private reconnectAfterFailedHealthCheck(reason: ToriiHealthUnreachableReason): void {
    const now = Date.now();
    if (now - this.lastStreamReconnectAtMs < this.currentReconnectCooldownMs()) return;

    const store = useConnectionStore.getState();
    store.setStatus("disconnected");
    store.setSpatialStatus("failed");
    store.setGlobalStatus("failed");
    store.incrementReconnectAttempts();
    this.markOutageStart();
    this.reportDeadEndIfNeeded(reason);

    this.lastStreamReconnectAtMs = now;
    void this.requestRecovery({ kind: "health_probe_failure", reason });
  }

  private isHeartbeatStale(store: ReturnType<typeof useConnectionStore.getState>): boolean {
    return store.toriiHeartbeatAvailable && Date.now() - store.lastToriiHeartbeat > this.staleThresholdMs;
  }

  private haveStreamsRecovered(store: ReturnType<typeof useConnectionStore.getState>): boolean {
    return store.spatialStatus === "connected" && store.globalStatus === "connected" && !this.isHeartbeatStale(store);
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
          store.resetReconnectAttempts();
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

  // --- Disconnect classification (LOCAL vs REMOTE) ---

  private handleStatusTransition(next: ConnectionStatus, previous: ConnectionStatus): void {
    if (this.disposed) return;
    if (previous === "connected" && next !== "connected") {
      const generation = ++this.classifyGeneration;
      void this.classifyOutage(generation);
    } else if (next === "connected" && previous !== "connected") {
      // Recovery invalidates any in-flight classification for the prior outage.
      this.classifyGeneration += 1;
    }
  }

  private async classifyOutage(generation: number): Promise<void> {
    const serverAvailability = await this.resolveServerAvailability();
    // The outage recovered (or the monitor was disposed) while we awaited the
    // server probe — drop the now-irrelevant classification.
    if (this.disposed || generation !== this.classifyGeneration) return;

    const snapshot = this.buildDisconnectSnapshot(serverAvailability);
    this.config.onDisconnectClassified?.(classifyDisconnect(snapshot), snapshot);
  }

  private async resolveServerAvailability(): Promise<ServerAvailabilityVerdict> {
    if (!this.config.getServerAvailability) return "unknown";
    try {
      return await this.config.getServerAvailability();
    } catch {
      return "unknown";
    }
  }

  private buildDisconnectSnapshot(serverAvailability: ServerAvailabilityVerdict): DisconnectSignalSnapshot {
    const store = useConnectionStore.getState();
    const now = Date.now();
    // Only trust navigator.onLine when it is a real boolean; otherwise fall back
    // to the store snapshot so non-browser/edge runtimes never read as "offline".
    const navigatorOnLine =
      typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : store.isOnline;
    return {
      onLine: navigatorOnLine,
      msSinceOffline: store.lastOfflineAt !== null ? now - store.lastOfflineAt : null,
      visibilityState: typeof document !== "undefined" && document.visibilityState === "hidden" ? "hidden" : "visible",
      healthProbeReason: this.resolveHealthProbeReason(),
      heartbeatAvailable: store.toriiHeartbeatAvailable,
      msSinceHeartbeat: store.toriiHeartbeatAvailable ? now - store.lastToriiHeartbeat : null,
      streamCloseObserved: store.lastStreamCloseAt !== null && now - store.lastStreamCloseAt <= this.staleThresholdMs,
      serverAvailability,
    };
  }

  private resolveHealthProbeReason(): HealthProbeSignal {
    const result = this.lastHealthProbeResult;
    if (!result) return "unknown";
    return result.status === "reachable" ? "reachable" : result.reason;
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
