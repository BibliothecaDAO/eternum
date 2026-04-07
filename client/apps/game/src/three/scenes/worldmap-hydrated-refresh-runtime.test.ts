import { describe, expect, it, vi } from "vitest";

import {
  createWorldmapHydratedRefreshQueueState,
  flushWorldmapHydratedChunkRefreshQueue,
  queueWorldmapHydratedChunkRefresh,
} from "./worldmap-hydrated-refresh-runtime";

describe("queueWorldmapHydratedChunkRefresh", () => {
  it("queues the chunk and schedules a single flush while one is not already pending", () => {
    const scheduleFlush = vi.fn();
    let state = createWorldmapHydratedRefreshQueueState();

    state = queueWorldmapHydratedChunkRefresh({
      chunkKey: "10,20",
      scheduleFlush,
      state,
    });

    expect(Array.from(state.queuedChunkKeys)).toEqual(["10,20"]);
    expect(state.isScheduled).toBe(true);
    expect(scheduleFlush).toHaveBeenCalledTimes(1);

    state = queueWorldmapHydratedChunkRefresh({
      chunkKey: "10,20",
      scheduleFlush,
      state,
    });

    expect(Array.from(state.queuedChunkKeys)).toEqual(["10,20"]);
    expect(scheduleFlush).toHaveBeenCalledTimes(1);
  });
});

describe("flushWorldmapHydratedChunkRefreshQueue", () => {
  it("waits for the active chunk switch, refreshes the current chunk, and clears the applied item", async () => {
    const scheduleFlush = vi.fn();
    const refreshCurrentChunk = vi.fn(async () => undefined);
    const onAfterRefresh = vi.fn();
    const warn = vi.fn();
    let state = createWorldmapHydratedRefreshQueueState();

    state = queueWorldmapHydratedChunkRefresh({
      chunkKey: "3,4",
      scheduleFlush,
      state,
    });

    const nextState = await flushWorldmapHydratedChunkRefreshQueue({
      awaitActiveChunkSwitch: vi.fn(async () => undefined),
      currentChunk: "3,4",
      isChunkTransitioning: false,
      onAfterRefresh,
      queueFlush: scheduleFlush,
      refreshCurrentChunk,
      state,
      warn,
    });

    expect(refreshCurrentChunk).toHaveBeenCalledTimes(1);
    expect(onAfterRefresh).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    expect(Array.from(nextState.queuedChunkKeys)).toEqual([]);
    expect(nextState.isScheduled).toBe(false);
  });

  it("preserves the queue and reschedules when a chunk transition is still running", async () => {
    const scheduleFlush = vi.fn();
    const refreshCurrentChunk = vi.fn(async () => undefined);
    let state = createWorldmapHydratedRefreshQueueState();

    state = queueWorldmapHydratedChunkRefresh({
      chunkKey: "8,9",
      scheduleFlush,
      state,
    });

    const nextState = await flushWorldmapHydratedChunkRefreshQueue({
      currentChunk: "8,9",
      isChunkTransitioning: true,
      onAfterRefresh: vi.fn(),
      queueFlush: scheduleFlush,
      refreshCurrentChunk,
      state,
      warn: vi.fn(),
    });

    expect(refreshCurrentChunk).not.toHaveBeenCalled();
    expect(Array.from(nextState.queuedChunkKeys)).toEqual(["8,9"]);
    expect(nextState.isScheduled).toBe(true);
    expect(scheduleFlush).toHaveBeenCalledTimes(2);
  });

  it("warns when the previous chunk switch fails but still drains the queue", async () => {
    const warn = vi.fn();
    const refreshCurrentChunk = vi.fn(async () => undefined);
    let state = createWorldmapHydratedRefreshQueueState();

    state = queueWorldmapHydratedChunkRefresh({
      chunkKey: "1,1",
      scheduleFlush: vi.fn(),
      state,
    });

    await flushWorldmapHydratedChunkRefreshQueue({
      awaitActiveChunkSwitch: vi.fn(async () => {
        throw new Error("switch failed");
      }),
      currentChunk: "1,1",
      isChunkTransitioning: false,
      onAfterRefresh: vi.fn(),
      queueFlush: vi.fn(),
      refreshCurrentChunk,
      state,
      warn,
    });

    expect(warn).toHaveBeenCalledWith(
      "Previous global chunk switch failed before hydrated refresh:",
      expect.any(Error),
    );
    expect(refreshCurrentChunk).toHaveBeenCalledTimes(1);
  });
});
