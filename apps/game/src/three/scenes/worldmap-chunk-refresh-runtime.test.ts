import { describe, expect, it, vi } from "vitest";

import {
  createWorldmapChunkRefreshRuntimeState,
  renewWorldmapChunkRefreshRuntimeState,
  requestWorldmapChunkRefreshToken,
  runWorldmapChunkRefreshExecution,
  type WorldmapChunkRefreshRuntimeState,
} from "./worldmap-chunk-refresh-runtime";

/** A refresh that runs until `finish` is called, on `state`, recording each rerun it schedules. */
function runningRefresh(state: WorldmapChunkRefreshRuntimeState) {
  let finish!: () => void;
  const scheduleRerun = vi.fn();
  const done = runWorldmapChunkRefreshExecution({
    executeRefresh: () => new Promise<void>((resolve) => (finish = resolve)),
    onError: vi.fn(),
    onExecutionComplete: vi.fn(),
    onRescheduleWhileRunning: vi.fn(),
    onSuperseded: vi.fn(),
    scheduledToken: requestWorldmapChunkRefreshToken(state),
    scheduleRerun,
    state,
  });
  return { finish: () => finish(), done, scheduleRerun };
}

describe("chunk refreshes across a reset", () => {
  it("reruns for a request made while a refresh ran", async () => {
    const state = createWorldmapChunkRefreshRuntimeState();
    const refresh = runningRefresh(state);
    requestWorldmapChunkRefreshToken(state);
    refresh.finish();
    await refresh.done;
    expect(refresh.scheduleRerun).toHaveBeenCalledTimes(1);
  });

  it("lets a refresh running at the reset settle on the old state, scheduling nothing on the fresh one", async () => {
    const old = createWorldmapChunkRefreshRuntimeState();
    const refresh = runningRefresh(old);
    requestWorldmapChunkRefreshToken(old);
    const waiter = vi.fn();
    old.waiters.add({ requestToken: 99, resolve: waiter });
    const fresh = renewWorldmapChunkRefreshRuntimeState(old, vi.fn());
    expect(waiter).toHaveBeenCalled();
    refresh.finish();
    await refresh.done;
    expect(refresh.scheduleRerun).not.toHaveBeenCalled();
    expect(fresh).toEqual(createWorldmapChunkRefreshRuntimeState());
  });

  it("clears the old state's pending timer", () => {
    const old = createWorldmapChunkRefreshRuntimeState();
    old.timeoutId = 42;
    const clear = vi.fn();
    renewWorldmapChunkRefreshRuntimeState(old, clear);
    expect(clear).toHaveBeenCalledWith(42);
  });
});
