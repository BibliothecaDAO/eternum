import { describe, expect, it, vi } from "vitest";

import {
  createReconnectRefreshQueueState,
  drainReconnectRefreshQueue,
  queueOrRunReconnectRefresh,
} from "./worldmap-reconnect-refresh-queue";

describe("worldmap reconnect refresh queue", () => {
  it("runs the refresh immediately when a valid chunk is active", () => {
    const state = createReconnectRefreshQueueState();
    const runRefresh = vi.fn();

    queueOrRunReconnectRefresh({ state, currentChunk: "24,24", runRefresh });

    expect(runRefresh).toHaveBeenCalledTimes(1);
    expect(state.hasPendingRefresh).toBe(false);
  });

  it("queues the refresh when currentChunk is the literal 'null'", () => {
    const state = createReconnectRefreshQueueState();
    const runRefresh = vi.fn();

    queueOrRunReconnectRefresh({ state, currentChunk: "null", runRefresh });

    expect(runRefresh).not.toHaveBeenCalled();
    expect(state.hasPendingRefresh).toBe(true);
  });

  it("queues the refresh when currentChunk is JS null", () => {
    const state = createReconnectRefreshQueueState();
    const runRefresh = vi.fn();

    queueOrRunReconnectRefresh({ state, currentChunk: null, runRefresh });

    expect(runRefresh).not.toHaveBeenCalled();
    expect(state.hasPendingRefresh).toBe(true);
  });

  it("drains a single queued refresh", () => {
    const state = createReconnectRefreshQueueState();
    state.hasPendingRefresh = true;
    const runRefresh = vi.fn();

    drainReconnectRefreshQueue({ state, runRefresh });

    expect(runRefresh).toHaveBeenCalledTimes(1);
    expect(state.hasPendingRefresh).toBe(false);
  });

  it("is a no-op to drain when no refresh is queued", () => {
    const state = createReconnectRefreshQueueState();
    const runRefresh = vi.fn();

    drainReconnectRefreshQueue({ state, runRefresh });

    expect(runRefresh).not.toHaveBeenCalled();
  });

  it("collapses multiple queued refreshes into a single drain", () => {
    const state = createReconnectRefreshQueueState();
    const runRefresh = vi.fn();

    queueOrRunReconnectRefresh({ state, currentChunk: "null", runRefresh });
    queueOrRunReconnectRefresh({ state, currentChunk: "null", runRefresh });
    drainReconnectRefreshQueue({ state, runRefresh });

    expect(runRefresh).toHaveBeenCalledTimes(1);
  });
});
