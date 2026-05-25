import { describe, expect, it, vi } from "vitest";

import {
  createWorldmapChunkRefreshRuntimeState,
  requestWorldmapChunkRefreshToken,
  runWorldmapChunkRefreshExecution,
  scheduleWorldmapChunkRefreshTimer,
  waitForWorldmapRequestedChunkRefresh,
} from "./worldmap-chunk-refresh-runtime";

describe("requestWorldmapChunkRefreshToken", () => {
  it("increments and returns the next request token", () => {
    const state = createWorldmapChunkRefreshRuntimeState();

    expect(requestWorldmapChunkRefreshToken(state)).toBe(1);
    expect(requestWorldmapChunkRefreshToken(state)).toBe(2);
    expect(state.requestToken).toBe(2);
  });
});

describe("scheduleWorldmapChunkRefreshTimer", () => {
  it("schedules a timer, updates runtime state, and clears timer state before running the callback", () => {
    const state = createWorldmapChunkRefreshRuntimeState();
    const clearTimeoutFn = vi.fn();
    const onTimer = vi.fn();
    const scheduled: Array<{ callback: () => void; delayMs: number; id: number }> = [];

    scheduleWorldmapChunkRefreshTimer({
      clearTimeoutFn,
      nowMs: 100,
      onTimer,
      requestedDelayMs: 25,
      setTimeoutFn: (callback, delayMs) => {
        scheduled.push({ callback, delayMs, id: 77 });
        return 77;
      },
      state,
    });

    expect(state.timeoutId).toBe(77);
    expect(state.deadlineAtMs).toBe(125);
    expect(scheduled).toHaveLength(1);

    scheduled[0].callback();

    expect(state.timeoutId).toBeNull();
    expect(state.deadlineAtMs).toBeNull();
    expect(onTimer).toHaveBeenCalledTimes(1);
    expect(clearTimeoutFn).not.toHaveBeenCalled();
  });
});

describe("waitForWorldmapRequestedChunkRefresh", () => {
  it("resolves immediately when switched off", async () => {
    const state = createWorldmapChunkRefreshRuntimeState();

    await expect(
      waitForWorldmapRequestedChunkRefresh({
        fallbackDelayMs: 20,
        isSwitchedOff: () => true,
        latestWinsRefresh: true,
        requestToken: 1,
        setTimeoutFn: vi.fn(() => 0),
        state,
      }),
    ).resolves.toBeUndefined();
  });

  it("waits for legacy scheduled refresh work to finish before resolving", async () => {
    const state = createWorldmapChunkRefreshRuntimeState();
    state.requestToken = 1;
    state.timeoutId = 77;

    const scheduledPolls: Array<() => void> = [];
    let didResolve = false;

    const waitPromise = waitForWorldmapRequestedChunkRefresh({
      fallbackDelayMs: 0,
      isSwitchedOff: () => false,
      latestWinsRefresh: false,
      requestToken: 1,
      setTimeoutFn: (callback) => {
        scheduledPolls.push(callback);
        return scheduledPolls.length;
      },
      state,
    }).then(() => {
      didResolve = true;
    });

    await Promise.resolve();
    expect(didResolve).toBe(false);
    expect(scheduledPolls).toHaveLength(1);

    scheduledPolls.shift()?.();
    await Promise.resolve();
    expect(didResolve).toBe(false);
    expect(scheduledPolls).toHaveLength(1);

    state.timeoutId = null;
    state.running = true;
    scheduledPolls.shift()?.();
    await Promise.resolve();
    expect(didResolve).toBe(false);
    expect(scheduledPolls).toHaveLength(1);

    state.running = false;
    state.appliedToken = 1;
    scheduledPolls.shift()?.();
    await waitPromise;

    expect(didResolve).toBe(true);
  });
});

describe("runWorldmapChunkRefreshExecution", () => {
  it("marks rerun requested and reschedules when a refresh is already running", async () => {
    const state = createWorldmapChunkRefreshRuntimeState();
    state.requestToken = 4;
    state.running = true;
    const scheduleRerun = vi.fn();
    const onRescheduleWhileRunning = vi.fn();

    await runWorldmapChunkRefreshExecution({
      executeRefresh: vi.fn(async () => undefined),
      onError: vi.fn(),
      onExecutionComplete: vi.fn(),
      onRescheduleWhileRunning,
      onSuperseded: vi.fn(),
      scheduledToken: 3,
      scheduleRerun,
      state,
    });

    expect(state.rerunRequested).toBe(true);
    expect(onRescheduleWhileRunning).toHaveBeenCalledTimes(1);
    expect(scheduleRerun).toHaveBeenCalledTimes(1);
  });

  it("runs the refresh, records the applied token, and schedules a rerun when a newer request arrives during execution", async () => {
    const state = createWorldmapChunkRefreshRuntimeState();
    state.requestToken = 1;
    const scheduleRerun = vi.fn();
    const onExecutionComplete = vi.fn();
    const executeRefresh = vi.fn(async () => {
      requestWorldmapChunkRefreshToken(state);
    });

    await runWorldmapChunkRefreshExecution({
      executeRefresh,
      onError: vi.fn(),
      onExecutionComplete,
      onRescheduleWhileRunning: vi.fn(),
      onSuperseded: vi.fn(),
      scheduledToken: 1,
      scheduleRerun,
      state,
    });

    expect(executeRefresh).toHaveBeenCalledTimes(1);
    expect(state.running).toBe(false);
    expect(state.appliedToken).toBe(1);
    expect(state.rerunRequested).toBe(false);
    expect(scheduleRerun).toHaveBeenCalledTimes(1);
    expect(onExecutionComplete).toHaveBeenCalledWith({
      executionToken: 1,
      hasNewerRequest: true,
      latestToken: 2,
    });
  });
});
