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

describe("ConnectionHealthMonitor", () => {
  beforeEach(() => {
    stubDomGlobals("visible");
    vi.useFakeTimers();
    addToriiStreamBreadcrumbMock.mockClear();
    reportToriiSubscriptionLifecycleMock.mockClear();
    useConnectionStore.setState({
      status: "connected",
      lastSpatialUpdate: Date.now(),
      lastGlobalUpdate: Date.now(),
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
    const healthCheckFn = vi.fn(() => Promise.resolve(true));

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

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

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
    const healthCheckFn = vi.fn(() => Promise.resolve(true));

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

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).not.toHaveBeenCalled();
    expect(onReconnectGlobal).not.toHaveBeenCalled();

    monitor.dispose();
  });

  it("does not reconnect from heartbeat staleness before a heartbeat source is registered", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(true));

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
    const healthCheckFn = vi.fn(() => Promise.resolve(true));

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
    const healthCheckFn = vi.fn(() => Promise.resolve(true));
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

  it("does not reconnect twice within a single staleThresholdMs window (cooldown)", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(true));

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
    const healthCheckFn = vi.fn(() => Promise.resolve(true));

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

  it("reconnects both streams when the health check throws", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.reject(new Error("offline")));

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
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);
    expect(useConnectionStore.getState().status).toBe("disconnected");

    monitor.dispose();
  });

  it("treats an unhealthy HTTP response as disconnected", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(false));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal,
      onReconnectSpatial,
      staleThresholdMs: 5_000,
    });

    monitor.start();
    monitor.exitBootGraceForTests();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);
    expect(useConnectionStore.getState().status).toBe("disconnected");
    expect(useConnectionStore.getState().spatialStatus).toBe("failed");
    expect(useConnectionStore.getState().globalStatus).toBe("failed");
    expect(useConnectionStore.getState().reconnectAttempts).toBe(1);

    monitor.dispose();
  });

  it("sets per-stream status to reconnecting then connected around a reconnect", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(true));

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
    const healthCheckFn = vi.fn(() => Promise.resolve(true));

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
    const healthCheckFn = vi.fn(() => (healthy ? Promise.resolve(true) : Promise.reject(new Error("offline"))));

    const monitor = new ConnectionHealthMonitor({
      healthCheckFn,
      healthCheckIntervalMs: 1_000,
      onReconnectGlobal: vi.fn(() => Promise.resolve()),
      onReconnectSpatial: vi.fn(() => Promise.resolve()),
      onRecovery,
      staleThresholdMs: 5_000,
      recoveryToastThresholdMs: 10_000,
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

    // Now succeed — next tick should flip to connected and fire onRecovery.
    healthy = true;
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onRecovery).toHaveBeenCalledTimes(1);
    expect(onRecovery.mock.calls[0][0]).toBeGreaterThanOrEqual(10_000);

    monitor.dispose();
  });

  it("records a stream reconnect after stale streams are rebuilt", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(true));

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
    const healthCheckFn = vi.fn(() => Promise.resolve(true));

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
    const healthCheckFn = vi.fn(() => Promise.resolve(true));

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

  it("exits boot grace once both streams tick after start, then behaves normally", async () => {
    const onReconnectSpatial = vi.fn(() => Promise.resolve());
    const onReconnectGlobal = vi.fn(() => Promise.resolve());
    const healthCheckFn = vi.fn(() => Promise.resolve(true));

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
    const healthCheckFn = vi.fn(() => Promise.resolve(true));

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
      activeWorld: { toriiBaseUrl: "https://api.cartridge.gg/x/s0-game-5/torii" },
      fallbackToriiUrl: "https://api.cartridge.gg/x/eternum-blitz-slot-4/torii",
      runtimeToriiUrl: "https://api.cartridge.gg/x/s0-game-5/torii",
    });

    expect(toriiBaseUrl).toBe("https://api.cartridge.gg/x/s0-game-5/torii");
  });

  it("uses the bootstrapped runtime Torii when no active profile is available", () => {
    const toriiBaseUrl = resolveConnectionHealthToriiBaseUrl({
      activeWorld: null,
      fallbackToriiUrl: "https://api.cartridge.gg/x/eternum-blitz-slot-4/torii",
      runtimeToriiUrl: "https://api.cartridge.gg/x/bltz-warzone-04/torii",
    });

    expect(toriiBaseUrl).toBe("https://api.cartridge.gg/x/bltz-warzone-04/torii");
  });
});
