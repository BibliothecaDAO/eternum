// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionHealthMonitor } from "./connection-health-monitor";
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
    useConnectionStore.setState({
      status: "connected",
      lastSpatialUpdate: Date.now(),
      lastGlobalUpdate: Date.now(),
      lastHealthCheck: Date.now(),
      reconnectAttempts: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    restoreDomGlobals();
  });

  it("reconnects streams during polling when spatial traffic has gone silent past the stale threshold", async () => {
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

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 10_000,
      lastGlobalUpdate: Date.now(),
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).not.toHaveBeenCalled();

    monitor.dispose();
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

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 10_000,
      lastGlobalUpdate: Date.now() - 10_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 11_000,
      lastGlobalUpdate: Date.now() - 11_000,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).toHaveBeenCalledTimes(1);
    expect(onReconnectGlobal).toHaveBeenCalledTimes(1);

    monitor.dispose();
  });

  it("does not reconnect when the health check fails", async () => {
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

    useConnectionStore.setState({
      lastSpatialUpdate: Date.now() - 10_000,
      lastGlobalUpdate: Date.now() - 10_000,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.runOnlyPendingTimersAsync();

    expect(onReconnectSpatial).not.toHaveBeenCalled();
    expect(onReconnectGlobal).not.toHaveBeenCalled();
    expect(useConnectionStore.getState().status).toBe("disconnected");

    monitor.dispose();
  });
});
