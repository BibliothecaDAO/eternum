import { describe, expect, it, vi } from "vitest";

import {
  clearWorldmapPostCommitManagerCatchUpState,
  createWorldmapPostCommitManagerCatchUpState,
  drainWorldmapPostCommitManagerCatchUpQueue,
  enqueueWorldmapPostCommitManagerCatchUpTask,
  scheduleWorldmapPostCommitManagerCatchUpDrain,
} from "./worldmap-post-commit-manager-catchup-runtime";

describe("enqueueWorldmapPostCommitManagerCatchUpTask", () => {
  it("appends tasks to the runtime queue", () => {
    const state = createWorldmapPostCommitManagerCatchUpState<{ chunkKey: string; estimatedUploadBytes: number }>();

    enqueueWorldmapPostCommitManagerCatchUpTask({
      state,
      task: { chunkKey: "0,0", estimatedUploadBytes: 10 },
    });

    expect(state.queue).toEqual([{ chunkKey: "0,0", estimatedUploadBytes: 10 }]);
  });
});

describe("scheduleWorldmapPostCommitManagerCatchUpDrain", () => {
  it("schedules only one pending drain at a time", () => {
    const state = createWorldmapPostCommitManagerCatchUpState();
    const onDrain = vi.fn();
    const requestAnimationFrameFn = vi.fn((callback: () => void) => {
      callback();
      return 7;
    });

    scheduleWorldmapPostCommitManagerCatchUpDrain({
      onDrain,
      requestAnimationFrameFn,
      setTimeoutFn: vi.fn(() => 0),
      state,
    });
    scheduleWorldmapPostCommitManagerCatchUpDrain({
      onDrain,
      requestAnimationFrameFn,
      setTimeoutFn: vi.fn(() => 0),
      state,
    });

    expect(onDrain).toHaveBeenCalledTimes(1);
  });
});

describe("drainWorldmapPostCommitManagerCatchUpQueue", () => {
  it("marks deferred head tasks and reschedules draining", async () => {
    const state = createWorldmapPostCommitManagerCatchUpState();
    state.queue = [{ chunkKey: "0,0", estimatedUploadBytes: 4096 }];
    const scheduleDrain = vi.fn();

    await drainWorldmapPostCommitManagerCatchUpQueue({
      budgetBytes: 1024,
      onImmediateTask: vi.fn(),
      onTaskError: vi.fn(),
      runTask: vi.fn(async () => undefined),
      scheduleDrain,
      shouldRunTask: vi.fn(() => true),
      state,
    });

    expect(state.queue[0].deferredCount).toBe(1);
    expect(scheduleDrain).toHaveBeenCalledTimes(1);
  });

  it("runs drained tasks sequentially and reschedules if queue remains", async () => {
    const state = createWorldmapPostCommitManagerCatchUpState();
    state.queue = [
      { chunkKey: "0,0", estimatedUploadBytes: 200 },
      { chunkKey: "24,24", estimatedUploadBytes: 200 },
    ];
    const onImmediateTask = vi.fn();
    const runTask = vi.fn(async () => undefined);
    const scheduleDrain = vi.fn();

    await drainWorldmapPostCommitManagerCatchUpQueue({
      budgetBytes: 250,
      onImmediateTask,
      onTaskError: vi.fn(),
      runTask,
      scheduleDrain,
      shouldRunTask: vi.fn(() => true),
      state,
    });

    expect(runTask).toHaveBeenCalledTimes(1);
    expect(onImmediateTask).toHaveBeenCalledTimes(1);
    expect(state.queue).toEqual([{ chunkKey: "24,24", estimatedUploadBytes: 200 }]);
    expect(scheduleDrain).toHaveBeenCalledTimes(1);
  });
});

describe("clearWorldmapPostCommitManagerCatchUpState", () => {
  it("clears queued work and cancels an animation frame handle", () => {
    const state = createWorldmapPostCommitManagerCatchUpState<{ chunkKey: string; estimatedUploadBytes: number }>();
    state.frameHandle = 11;
    state.queue = [{ chunkKey: "0,0", estimatedUploadBytes: 10 }];
    const cancelAnimationFrameFn = vi.fn();
    const clearTimeoutFn = vi.fn();

    clearWorldmapPostCommitManagerCatchUpState({
      cancelAnimationFrameFn,
      clearTimeoutFn,
      state,
      usesAnimationFrame: true,
    });

    expect(cancelAnimationFrameFn).toHaveBeenCalledWith(11);
    expect(clearTimeoutFn).not.toHaveBeenCalled();
    expect(state.frameHandle).toBeNull();
    expect(state.queue).toEqual([]);
  });
});
