import { describe, expect, it, vi } from "vitest";

import { waitForWorldmapAuthoritativeBarrier } from "./worldmap-authoritative-barrier";
import { createDeferred } from "./worldmap-test-harness";

describe("waitForWorldmapAuthoritativeBarrier", () => {
  it("returns ready when the barrier resolves before timeout", async () => {
    vi.useFakeTimers();
    const deferred = createDeferred<void>();

    const barrierPromise = waitForWorldmapAuthoritativeBarrier({
      label: "structure authoritative",
      promise: deferred.promise,
      timeoutMs: 1000,
      isSwitchedOff: () => false,
      isCurrentTransition: () => true,
    });

    deferred.resolve();
    await vi.runAllTimersAsync();

    await expect(barrierPromise).resolves.toMatchObject({
      status: "ready",
      label: "structure authoritative",
    });

    vi.useRealTimers();
  });

  it("returns aborted when the transition becomes stale before the barrier resolves", async () => {
    vi.useFakeTimers();
    const deferred = createDeferred<void>();
    let isCurrentTransition = true;

    const barrierPromise = waitForWorldmapAuthoritativeBarrier({
      label: "tile authoritative",
      promise: deferred.promise,
      timeoutMs: 1000,
      isSwitchedOff: () => false,
      isCurrentTransition: () => isCurrentTransition,
      pollIntervalMs: 16,
    });

    isCurrentTransition = false;
    await vi.advanceTimersByTimeAsync(16);

    await expect(barrierPromise).resolves.toMatchObject({
      status: "aborted",
      label: "tile authoritative",
    });

    vi.useRealTimers();
  });

  it("returns aborted when the scene switches off before the barrier resolves", async () => {
    vi.useFakeTimers();
    const deferred = createDeferred<void>();
    let switchedOff = false;

    const barrierPromise = waitForWorldmapAuthoritativeBarrier({
      label: "tile authoritative",
      promise: deferred.promise,
      timeoutMs: 1000,
      isSwitchedOff: () => switchedOff,
      isCurrentTransition: () => true,
      pollIntervalMs: 16,
    });

    switchedOff = true;
    await vi.advanceTimersByTimeAsync(16);

    await expect(barrierPromise).resolves.toMatchObject({
      status: "aborted",
      label: "tile authoritative",
    });

    vi.useRealTimers();
  });

  it("returns timed_out when the barrier never resolves", async () => {
    vi.useFakeTimers();
    const deferred = createDeferred<void>();

    const barrierPromise = waitForWorldmapAuthoritativeBarrier({
      label: "structure authoritative",
      promise: deferred.promise,
      timeoutMs: 1000,
      isSwitchedOff: () => false,
      isCurrentTransition: () => true,
    });

    await vi.advanceTimersByTimeAsync(1000);

    await expect(barrierPromise).resolves.toMatchObject({
      status: "timed_out",
      label: "structure authoritative",
    });

    vi.useRealTimers();
  });
});
