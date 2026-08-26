// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { addToriiStreamBreadcrumbMock, reportToriiSubscriptionLifecycleMock } = vi.hoisted(() => ({
  addToriiStreamBreadcrumbMock: vi.fn(),
  reportToriiSubscriptionLifecycleMock: vi.fn(),
}));

vi.mock("@/observability/network-health-reporting", () => ({
  addToriiStreamBreadcrumb: addToriiStreamBreadcrumbMock,
  reportToriiSubscriptionLifecycle: reportToriiSubscriptionLifecycleMock,
}));

import {
  ConnectionHealthMonitor,
  resolveConnectionHealthToriiBaseUrl,
  subscribeToToriiHeartbeat,
} from "./connection-health-monitor";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import type { ToriiHealthProbeResult } from "./torii-health-probe";

interface FakeEventTarget {
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

const originalDocument = (globalThis as { document?: unknown }).document;
const originalWindow = (globalThis as { window?: unknown }).window;

function stubDomGlobals(visibility: "visible" | "hidden" = "visible") {
  const doc: FakeEventTarget & { visibilityState: string } = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    visibilityState: visibility,
  };
  const win: FakeEventTarget = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  (globalThis as { document: unknown }).document = doc;
  (globalThis as { window: unknown }).window = win;
  return { doc, win };
}

function restoreDomGlobals() {
  if (originalDocument === undefined) {
    delete (globalThis as { document?: unknown }).document;
  } else {
    (globalThis as { document: unknown }).document = originalDocument;
  }
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window: unknown }).window = originalWindow;
  }
}

const reachableHealth = (source: "health" | "sql_fallback" = "health"): ToriiHealthProbeResult => ({
  status: "reachable",
  source,
  httpStatus: 200,
});

const unreachableHealth = (
  reason: "endpoint_not_found" | "timeout" | "network_error" | "server_error",
): ToriiHealthProbeResult => ({
  status: "unreachable",
  reason,
});

describe("ConnectionHealthMonitor", () => {
  beforeEach(() => {
    stubDomGlobals("visible");
    vi.useFakeTimers();
    addToriiStreamBreadcrumbMock.mockClear();
    reportToriiSubscriptionLifecycleMock.mockClear();
    useConnectionStore.setState({
      status: "connected",
      spatialStatus: "connected",
      globalStatus: "connected",
      lastSpatialUpdate: Date.now(),
      lastGlobalUpdate: Date.now(),
      lastSpatialHandshake: 0,
      lastGlobalHandshake: 0,
      toriiHeartbeatAvailable: true,
      lastHealthCheck: Date.now(),
      reconnectAttempts: 0,
      streamReconnectVersion: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    restoreDomGlobals();
  });

  it("reconnects both streams during polling when the Torii heartbeat is stale", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now(),
      lastGlobalUpdate: Date.now(),
      lastToriiHeartbeat: Date.now() - 10_000,
    });

    await vi.advanceTimersByTimeAsync(2_000);

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);
    expect(reportToriiSubscriptionLifecycleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        streamType: "both",
        kind: "heartbeat",
        outcome: "stale",
        durationMs: expect.any(Number),
      }),
    );

    monitor.dispose();
  });

  it("does not reconnect quiet streams while the Torii heartbeat is fresh", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 10_000,
      lastGlobalUpdate: Date.now() - 10_000,
      lastToriiHeartbeat: Date.now(),
    } as any);

    await vi.advanceTimersByTimeAsync(2_000);

    expect(onReconnectSpatial).not.toHaveBeenCalled();
    expect(onReconnectGlobal).not.toHaveBeenCalled();

    monitor.dispose();
  });

  it("does not reconnect from heartbeat staleness before a heartbeat source is registered", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    useConnectionStore.setState({
      lastToriiHeartbeat: Date.now() - 10_000,
      toriiHeartbeatAvailable: false,
    } as any);

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).not.toHaveBeenCalled();
    expect(onReconnectGlobal).not.toHaveBeenCalled();
    expect(reportToriiSubscriptionLifecycleMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "heartbeat",
        outcome: "stale",
      }),
    );

    monitor.dispose();
  });

  it("reconnects both streams when the Torii heartbeat is stale even if entity data is quiet", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now(),
      lastGlobalUpdate: Date.now(),
      lastToriiHeartbeat: Date.now() - 10_000,
    } as any);

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);

    monitor.dispose();
  });

  it("runs a health check immediately when the page is restored from browser cache", async () => {
    const { win } = stubDomGlobals("visible");
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));
    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 60_000,
      onReconnectGlobal: vi.fn(() => Promise.resolve()),
      onReconnectSpatial: vi.fn(() => Promise.resolve()),
      staleThresholdMs: 5_000,
    });

    monitor.start();

    const pageshowHandler = win.addEventListener.mock.calls.find(([event]) => event === "pageshow")?.[1] as
      | (() => void)
      | undefined;

    expect(pageshowHandler).toEqual(expect.any(Function));
    pageshowHandler?.();
    await Promise.resolve();

    expect(healthCheckFn).toHaveBeenCalledTimes(1);

    monitor.dispose();
  });

  it("records heartbeat timestamps from Torii indexer updates", async () => {
    const cancel = vi.fn();
    let onIndexerUpdated!: () => void;
    const toriiClient = {
      onIndexerUpdated: vi.fn(async (_contractAddress: string | null, callback: () => void) => {
        onIndexerUpdated = callback;
        return { cancel };
      }),
    };

    useConnectionStore.setState({ lastToriiHeartbeat: Date.now() - 10_000 } as any);
    const subscription = await subscribeToToriiHeartbeat(toriiClient as any);

    onIndexerUpdated();

    expect(useConnectionStore.getState().lastToriiHeartbeat).toBe(Date.now());
    expect(useConnectionStore.getState().toriiHeartbeatAvailable).toBe(true);
    expect(addToriiStreamBreadcrumbMock).toHaveBeenCalledWith({
      event: "heartbeat_received",
      streamType: "both",
    });
    expect(toriiClient.onIndexerUpdated).toHaveBeenCalledWith(null, expect.any(Function));

    subscription?.cancel();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("records a browser offline event so a later outage can be classified LOCAL", () => {
    const monitor = new ConnectionHealthMonitor({
      healthCheckFn: vi.fn(() => Promise.resolve(reachableHealth())),
      onReconnectGlobal: vi.fn(() => Promise.resolve()),
      onReconnectSpatial: vi.fn(() => Promise.resolve()),
    });
    monitor.start();

    const win = (globalThis as unknown as { window: FakeEventTarget }).window;
    const offlineCall = win.addEventListener.mock.calls.find((call) => call[0] === "offline");
    const offlineHandler = offlineCall?.[1] as (() => void) | undefined;
    expect(offlineHandler).toBeTypeOf("function");

    offlineHandler?.();

    expect(useConnectionStore.getState().isOnline).toBe(false);
    expect(useConnectionStore.getState().lastOfflineAt).toBe(Date.now());

    monitor.dispose();
  });

  it("classifies an outage with server availability when status leaves connected", async () => {
    useConnectionStore.setState({
      status: "connected",
      isOnline: true,
      lastOfflineAt: null,
      lastStreamCloseAt: null,
    } as any);
    const onDisconnectClassified = vi.fn();
    const getServerAvailability = vi.fn(() => Promise.resolve("alive" as const));
    const monitor = new ConnectionHealthMonitor({
      healthCheckFn: vi.fn(() => Promise.resolve(reachableHealth())),
      onReconnectGlobal: vi.fn(() => Promise.resolve()),
      onReconnectSpatial: vi.fn(() => Promise.resolve()),
      getServerAvailability,
      onDisconnectClassified,
    });
    monitor.start();

    useConnectionStore.getState().setStatus("disconnected");
    await vi.runOnlyPendingTimersAsync();

    expect(getServerAvailability).toHaveBeenCalledTimes(1);
    expect(onDisconnectClassified).toHaveBeenCalledTimes(1);
    const [, snapshot] = onDisconnectClassified.mock.calls[0];
    expect(snapshot.serverAvailability).toBe("alive");

    monitor.dispose();
  });

  it("drops classification if the outage recovers before the server probe resolves", async () => {
    useConnectionStore.setState({ status: "connected", isOnline: true, lastOfflineAt: null } as any);
    const onDisconnectClassified = vi.fn();
    let resolveAvailability!: (value: "alive" | "dead" | "unknown") => void;
    const getServerAvailability = vi.fn(
      () =>
        new Promise<"alive" | "dead" | "unknown">((resolve) => {
          resolveAvailability = resolve;
        }),
    );
    const monitor = new ConnectionHealthMonitor({
      healthCheckFn: vi.fn(() => Promise.resolve(reachableHealth())),
      onReconnectGlobal: vi.fn(() => Promise.resolve()),
      onReconnectSpatial: vi.fn(() => Promise.resolve()),
      getServerAvailability,
      onDisconnectClassified,
    });
    monitor.start();

    useConnectionStore.getState().setStatus("disconnected"); // starts classification, awaits probe
    useConnectionStore.getState().setStatus("connected"); // recovery invalidates the generation
    resolveAvailability("dead");
    await vi.runOnlyPendingTimersAsync();

    expect(onDisconnectClassified).not.toHaveBeenCalled();

    monitor.dispose();
  });

  it("catches heartbeat staleness via the watchdog without waiting for a health probe", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const monitor = new ConnectionHealthMonitor({
      healthCheckFn: vi.fn(() => Promise.resolve(reachableHealth())),
      healthCheckIntervalMs: 60_000, // probe effectively never fires in-window
      heartbeatWatchdogIntervalMs: 1_000,
      staleThresholdMs: 5_000,
      minReconnectCooldownMs: 1_000,
      maxReconnectCooldownMs: 30_000,
      onReconnectGlobal,
      onReconnectSpatial,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now(),
      lastGlobalUpdate: Date.now(),
      lastToriiHeartbeat: Date.now() - 10_000,
      toriiHeartbeatAvailable: true,
    } as any);

    await vi.advanceTimersByTimeAsync(1_200);

    expect(onReconnectSpatial).toHaveBeenCalled();
    expect(onReconnectGlobal).toHaveBeenCalled();

    monitor.dispose();
  });

  it("recovers fast-first with adaptive backoff instead of a flat cooldown", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const monitor = new ConnectionHealthMonitor({
      healthCheckFn: vi.fn(() => Promise.resolve(reachableHealth())),
      healthCheckIntervalMs: 60_000,
      heartbeatWatchdogIntervalMs: 500,
      staleThresholdMs: 5_000,
      minReconnectCooldownMs: 1_000,
      maxReconnectCooldownMs: 30_000,
      onReconnectGlobal,
      onReconnectSpatial,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    // Heartbeat stays stale (never refreshed), so each cooldown window yields one
    // more reconnect. With min=1s a flat 60s cooldown would allow only one.
    useConnectionStore.setState({
      lastSpatialUpdate: Date.now(),
      lastGlobalUpdate: Date.now(),
      lastToriiHeartbeat: Date.now() - 10_000,
      toriiHeartbeatAvailable: true,
    } as any);

    await vi.advanceTimersByTimeAsync(2_600);

    expect(onReconnectGlobal.mock.calls.length).toBeGreaterThanOrEqual(2);

    monitor.dispose();
  });

  it("uses the quiet-stream fallback only when Torii heartbeat is unavailable", async () => {
    useConnectionStore.setState({
      status: "connected",
      spatialStatus: "connected",
      globalStatus: "connected",
      toriiHeartbeatAvailable: false,
      lastToriiHeartbeat: Date.now(),
      lastGlobalDataUpdate: Date.now() - 60_000,
      lastSpatialDataUpdate: Date.now() - 60_000,
      lastGlobalHandshake: Date.now() - 60_000,
      lastSpatialHandshake: Date.now() - 60_000,
    } as any);

    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const onDisconnectClassified = vi.fn();
    const monitor = new ConnectionHealthMonitor({
      healthCheckFn: vi.fn(() => Promise.resolve(reachableHealth())),
      healthCheckIntervalMs: 60_000,
      heartbeatWatchdogIntervalMs: 1_000,
      staleThresholdMs: 5_000,
      quietStreamRefreshMs: 30_000,
      minReconnectCooldownMs: 1_000,
      maxReconnectCooldownMs: 30_000,
      onReconnectGlobal,
      onReconnectSpatial,
      onDisconnectClassified,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    await vi.advanceTimersByTimeAsync(1_200);

    expect(onReconnectGlobal).toHaveBeenCalled();
    expect(useConnectionStore.getState().status).toBe("connected");
    expect(onDisconnectClassified).not.toHaveBeenCalled();

    monitor.dispose();
  });

  it("does not refresh a quiet stream when Torii heartbeat is available", async () => {
    useConnectionStore.setState({
      status: "connected",
      spatialStatus: "connected",
      globalStatus: "connected",
      toriiHeartbeatAvailable: true,
      lastToriiHeartbeat: Date.now(),
      lastGlobalDataUpdate: Date.now() - 60_000,
      lastSpatialDataUpdate: Date.now() - 60_000,
      lastGlobalHandshake: Date.now() - 60_000,
      lastSpatialHandshake: Date.now() - 60_000,
    } as any);

    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const monitor = new ConnectionHealthMonitor({
      healthCheckFn: vi.fn(() => Promise.resolve(reachableHealth())),
      healthCheckIntervalMs: 60_000,
      heartbeatWatchdogIntervalMs: 1_000,
      quietStreamRefreshMs: 30_000,
      onReconnectGlobal,
      onReconnectSpatial,
    });

    monitor.start();
    monitor.exitBootGraceForTests();
    await vi.advanceTimersByTimeAsync(1_200);

    expect(onReconnectGlobal).not.toHaveBeenCalled();
    expect(onReconnectSpatial).not.toHaveBeenCalled();

    monitor.dispose();
  });

  it("routes an observed stream close through the shared recovery entry point", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const monitor = new ConnectionHealthMonitor({
      healthCheckFn: vi.fn(() => Promise.resolve(reachableHealth())),
      onReconnectGlobal,
      onReconnectSpatial,
    });

    monitor.start();
    await monitor.requestRecovery({ kind: "stream_close", stream: "event", reason: "HTTP2 stream failed" });

    expect(useConnectionStore.getState().lastStreamCloseAt).toBe(Date.now());
    expect(onReconnectGlobal).toHaveBeenCalledOnce();
    expect(onReconnectSpatial).toHaveBeenCalledOnce();
    expect(useConnectionStore.getState().status).toBe("connected");
    expect(warn).toHaveBeenCalledWith(
      '[ConnectionHealthMonitor] recovery requested kind="stream_close" stream="event" reason="HTTP2 stream failed"',
    );

    monitor.dispose();
  });

  it("does not reconnect twice within a single staleThresholdMs window (cooldown)", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 10_000,
      lastGlobalUpdate: Date.now() - 10_000,
      lastToriiHeartbeat: Date.now() - 10_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 11_000,
      lastGlobalUpdate: Date.now() - 11_000,
      lastToriiHeartbeat: Date.now() - 11_000,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);

    monitor.dispose();
  });

  it("uses a separate reconnect cooldown so idle worlds do not resubscribe every stale threshold", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      reconnectCooldownMs: 20_000,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 10_000,
      lastGlobalUpdate: Date.now() - 10_000,
      lastToriiHeartbeat: Date.now() - 10_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(2);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(2);

    monitor.dispose();
  });

  it("reconnects both streams when a thrown health check reaches the transient threshold", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.reject(new Error("offline")));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
      transientHealthFailureThreshold: 1,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 10_000,
      lastGlobalUpdate: Date.now() - 10_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);
    expect(useConnectionStore.getState().status).toBe("connected");

    monitor.dispose();
  });

  it("treats an unhealthy HTTP response as recovered when transient reconnect succeeds", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(unreachableHealth("server_error")));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
      transientHealthFailureThreshold: 1,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);
    expect(useConnectionStore.getState().status).toBe("connected");
    expect(useConnectionStore.getState().spatialStatus).toBe("connected");
    expect(useConnectionStore.getState().globalStatus).toBe("connected");
    expect(useConnectionStore.getState().reconnectAttempts).toBe(0);

    monitor.dispose();
  });

  it("does not reconnect when health succeeds through the SQL fallback", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth("sql_fallback")));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();
    useConnectionStore.setState({ lastToriiHeartbeat: Date.now() });

    await vi.advanceTimersByTimeAsync(1_000);

    expect(onReconnectSpatial).not.toHaveBeenCalled();
    expect(onReconnectGlobal).not.toHaveBeenCalled();
    expect(useConnectionStore.getState().status).toBe("connected");

    monitor.dispose();
  });

  it("does not mark streams failed after one transient failed probe", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(unreachableHealth("timeout")));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();
    useConnectionStore.setState({ lastToriiHeartbeat: Date.now() });

    await vi.advanceTimersByTimeAsync(1_000);

    expect(onReconnectSpatial).not.toHaveBeenCalled();
    expect(onReconnectGlobal).not.toHaveBeenCalled();
    expect(useConnectionStore.getState().status).toBe("connected");
    expect(useConnectionStore.getState().reconnectAttempts).toBe(0);

    monitor.dispose();
  });

  it("marks streams failed and reconnects after two consecutive transient failed probes", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(unreachableHealth("timeout")));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();
    useConnectionStore.setState({ lastToriiHeartbeat: Date.now() });

    await vi.advanceTimersByTimeAsync(2_000);

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);
    expect(useConnectionStore.getState().reconnectAttempts).toBe(0);

    monitor.dispose();
  });

  it("treats a successful transient-health reconnect as connected stream recovery", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(unreachableHealth("timeout")));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();
    useConnectionStore.setState({ lastToriiHeartbeat: Date.now() });

    await vi.advanceTimersByTimeAsync(2_000);

    const state = useConnectionStore.getState();
    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);
    expect(state.spatialStatus).toBe("connected");
    expect(state.globalStatus).toBe("connected");
    expect(state.status).toBe("connected");
    expect(state.reconnectAttempts).toBe(0);

    monitor.dispose();
  });

  it("does not inflate transient reconnect attempts while the reconnect cooldown is active", async () => {
    const onDeadEnd = vi.fn();
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(unreachableHealth("timeout")));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onDeadEnd,
      onReconnectGlobal,
      onReconnectSpatial,
      reconnectCooldownMs: 10_000,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();
    useConnectionStore.setState({ lastToriiHeartbeat: Date.now() });

    await vi.advanceTimersByTimeAsync(2_000);
    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);
    expect(useConnectionStore.getState().reconnectAttempts).toBe(0);

    await vi.advanceTimersByTimeAsync(8_000);
    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);
    expect(useConnectionStore.getState().reconnectAttempts).toBe(0);
    expect(onDeadEnd).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_000);
    expect(onReconnectSpatial).toHaveBeenCalledTimes(2);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(2);
    expect(useConnectionStore.getState().reconnectAttempts).toBe(0);

    monitor.dispose();
  });

  it("keeps stream outage attempts across reachable health probes when reconnect keeps failing", async () => {
    const onDeadEnd = vi.fn();
    const onReconnectSpatial = vi.fn(() => Promise.reject(new Error("spatial stream failed")));
    const onReconnectGlobal = vi.fn(() => Promise.reject(new Error("global stream failed")));
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onDeadEnd,
      onReconnectGlobal,
      onReconnectSpatial,
      deadEndAttempts: 2,
      reconnectCooldownMs: 1_000,
      staleThresholdMs: 500,
    });

    monitor.start();
    monitor.exitBootGraceForTests();
    useConnectionStore.setState({
      lastToriiHeartbeat: Date.now() - 5_000,
      toriiHeartbeatAvailable: true,
    } as any);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(useConnectionStore.getState().reconnectAttempts).toBe(1);
    expect(onDeadEnd).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);

    const state = useConnectionStore.getState();
    expect(state.reconnectAttempts).toBe(2);
    expect(state.status).toBe("disconnected");
    expect(state.lastDisconnectedAt).toBeGreaterThan(0);
    expect(onDeadEnd).toHaveBeenCalledTimes(1);

    monitor.dispose();
  });

  it("keeps failed stream state when only the heartbeat recovers", async () => {
    const onRecovery = vi.fn();
    const onReconnectSpatial = vi.fn(() => Promise.reject(new Error("spatial stream failed")));
    const onReconnectGlobal = vi.fn(() => Promise.reject(new Error("global stream failed")));
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      onRecovery,
      reconnectCooldownMs: 60_000,
      staleThresholdMs: 5_000,
      recoveryToastThresholdMs: 0,
    });

    monitor.start();
    monitor.exitBootGraceForTests();
    useConnectionStore.setState({
      lastToriiHeartbeat: Date.now() - 10_000,
      toriiHeartbeatAvailable: true,
    } as any);

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(useConnectionStore.getState().globalStatus).toBe("failed");
    expect(useConnectionStore.getState().reconnectAttempts).toBe(1);

    useConnectionStore.getState().recordToriiHeartbeat();
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    const state = useConnectionStore.getState();
    expect(state.status).toBe("disconnected");
    expect(state.spatialStatus).toBe("failed");
    expect(state.globalStatus).toBe("failed");
    expect(state.reconnectAttempts).toBe(1);
    expect(onRecovery).not.toHaveBeenCalled();

    monitor.dispose();
  });

  it("resets the transient failure streak after a successful probe", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi
      .fn<() => Promise<ToriiHealthProbeResult>>()
      .mockResolvedValueOnce(unreachableHealth("network_error"))
      .mockResolvedValueOnce(reachableHealth())
      .mockResolvedValueOnce(unreachableHealth("network_error"));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();
    useConnectionStore.setState({ lastToriiHeartbeat: Date.now() });

    await vi.advanceTimersByTimeAsync(3_000);

    expect(onReconnectSpatial).not.toHaveBeenCalled();
    expect(onReconnectGlobal).not.toHaveBeenCalled();
    expect(useConnectionStore.getState().reconnectAttempts).toBe(0);

    monitor.dispose();
  });

  it("reports endpoint_not_found as a dead end once without stream resubscribe loops", async () => {
    const onDeadEnd = vi.fn();
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(unreachableHealth("endpoint_not_found")));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onDeadEnd,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();
    useConnectionStore.setState({ lastToriiHeartbeat: Date.now() });

    await vi.advanceTimersByTimeAsync(3_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onDeadEnd).toHaveBeenCalledTimes(1);
    expect(onDeadEnd).toHaveBeenCalledWith(expect.any(Number), 1, "endpoint_not_found");
    expect(onReconnectSpatial).not.toHaveBeenCalled();
    expect(onReconnectGlobal).not.toHaveBeenCalled();

    monitor.dispose();
  });

  it("sets per-stream status to reconnecting then connected around a reconnect", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    let spatialStatusDuringReconnect: string | null = null;
    const origSetSpatialStatus = useConnectionStore.getState().setSpatialStatus;
    useConnectionStore.setState({
      setSpatialStatus: (s) => {
        if (s === "reconnecting") spatialStatusDuringReconnect = s;
        origSetSpatialStatus(s);
      },
    });

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();
    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 10_000,
      lastGlobalUpdate: Date.now(),
      lastToriiHeartbeat: Date.now() - 10_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(spatialStatusDuringReconnect).toBe("reconnecting");
    expect(useConnectionStore.getState().spatialStatus).toBe("connected");

    monitor.dispose();
  });

  it("forceReconnect bypasses the reconnect cooldown", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      reconnectCooldownMs: 20_000,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();
    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 10_000,
      lastGlobalUpdate: Date.now() - 10_000,
      lastToriiHeartbeat: Date.now() - 10_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);

    await monitor.forceReconnect();
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(2);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(2);

    monitor.dispose();
  });

  it("fires onRecovery after an outage >= recoveryToastThresholdMs", async () => {
    const onRecovery = vi.fn();
    let healthy = false;
    const onReconnectSpatial = vi.fn(() =>
      healthy ? Promise.resolve() : Promise.reject(new Error("spatial offline")),
    );
    const onReconnectGlobal = vi.fn(() => (healthy ? Promise.resolve() : Promise.reject(new Error("global offline"))));
    const healthCheckFn = vi.fn(() =>
      healthy ? Promise.resolve(reachableHealth()) : Promise.reject(new Error("offline")),
    );

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      onRecovery,
      reconnectCooldownMs: 5_000,
      staleThresholdMs: 5_000,
      recoveryToastThresholdMs: 10_000,
      transientHealthFailureThreshold: 1,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    // First tick: health check fails → pendingRecoveryToastFromMs is stamped.
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();
    expect(useConnectionStore.getState().status).toBe("disconnected");
    expect(onRecovery).not.toHaveBeenCalled();

    // Keep failing for >10s of real (fake) time so outage threshold is cleared.
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.runOnlyPendingTimersAsync();
    expect(onRecovery).not.toHaveBeenCalled();

    // Now the service and stream state recover — next tick should fire onRecovery.
    healthy = true;
    useConnectionStore.setState({
      spatialStatus: "connected",
      globalStatus: "connected",
      status: "connected",
      lastToriiHeartbeat: Date.now(),
    } as any);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onRecovery).toHaveBeenCalledTimes(1);
    expect(onRecovery.mock.calls[0][0]).toBeGreaterThanOrEqual(10_000);

    monitor.dispose();
  });

  it("records a stream reconnect after stale streams are rebuilt", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 10_000,
      lastGlobalUpdate: Date.now() - 10_000,
      lastToriiHeartbeat: Date.now() - 10_000,
      streamReconnectVersion: 0,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(useConnectionStore.getState().streamReconnectVersion).toBe(1);

    monitor.dispose();
  });

  it("still bumps streamReconnectVersion when reconnect handlers reject so scoped subs can retry", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.reject(new Error("spatial torii hung")));
    const onReconnectGlobal = vi.fn(() => Promise.reject(new Error("global initialSync timed out")));
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 10_000,
      lastGlobalUpdate: Date.now() - 10_000,
      lastToriiHeartbeat: Date.now() - 10_000,
      streamReconnectVersion: 0,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(useConnectionStore.getState().streamReconnectVersion).toBe(1);
    expect(onReconnectSpatial).toHaveBeenCalled();
    expect(onReconnectGlobal).toHaveBeenCalled();

    monitor.dispose();
  });

  it("does not auto-reconnect during boot grace even if stream timestamps look stale", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    // Simulate a slow boot: timestamps are from before the monitor started.
    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 10_000,
      lastGlobalUpdate: Date.now() - 10_000,
    });

    // Several ticks pass with streams still "stale" by timestamp.
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).not.toHaveBeenCalled();
    expect(onReconnectGlobal).not.toHaveBeenCalled();

    monitor.dispose();
  });

  it("observes existing stream handshakes at start so quiet worlds can recover stale heartbeats", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    useConnectionStore.setState({
      lastSpatialHandshake: Date.now() - 1_000,
      lastGlobalHandshake: Date.now() - 1_000,
      lastToriiHeartbeat: Date.now() - 10_000,
    });

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);

    monitor.dispose();
  });

  it("exits boot grace once both streams tick after start, then behaves normally", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();

    // Simulate streams ticking healthily after start.
    await vi.advanceTimersByTimeAsync(1_000);
    useConnectionStore.setState({
      lastSpatialUpdate: Date.now(),
      lastGlobalUpdate: Date.now(),
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    // Now drive them stale. Grace should have exited; reconnect should fire.
    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 10_000,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);

    monitor.dispose();
  });

  it("forceReconnect works during boot grace (manual retry always allowed)", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(reachableHealth()));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    // Grace is active (no exitBootGraceForTests call).

    await monitor.forceReconnect();
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);

    monitor.dispose();
  });
});

describe("resolveConnectionHealthToriiBaseUrl", () => {
  it("prefers the active world Torii over the static env fallback", () => {
    const toriiBaseUrl = resolveConnectionHealthToriiBaseUrl({
      activeWorld: { toriiBaseUrl: "https://api.realms.world/x/s0-game-5/torii" },
      fallbackToriiUrl: "https://api.realms.world/x/eternum-blitz-1/torii",
      runtimeToriiUrl: "https://api.realms.world/x/s0-game-5/torii",
    });

    expect(toriiBaseUrl).toBe("https://api.realms.world/x/s0-game-5/torii");
  });

  it("uses the bootstrapped runtime Torii when no active profile is available", () => {
    const toriiBaseUrl = resolveConnectionHealthToriiBaseUrl({
      activeWorld: null,
      fallbackToriiUrl: "https://api.realms.world/x/eternum-blitz-1/torii",
      runtimeToriiUrl: "https://api.realms.world/x/bltz-warzone-04/torii",
    });

    expect(toriiBaseUrl).toBe("https://api.realms.world/x/bltz-warzone-04/torii");
  });
});
