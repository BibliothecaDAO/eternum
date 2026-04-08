import { describe, expect, it, vi } from "vitest";

import {
  createWorldmapChunkTransitionRuntimeState,
  runWorldmapChunkTransition,
} from "./worldmap-chunk-transition-runtime";

describe("runWorldmapChunkTransition", () => {
  it("tracks the active promise while the transition runs and clears ownership afterward", async () => {
    const state = createWorldmapChunkTransitionRuntimeState();
    let resolveTransition!: () => void;
    const transitionPromise = new Promise<void>((resolve) => {
      resolveTransition = resolve;
    });

    const onResolved = vi.fn(() => true);
    const onFinally = vi.fn();

    const runPromise = runWorldmapChunkTransition({
      onFinally,
      onResolved,
      state,
      transitionPromise,
    });

    expect(state.isTransitioning).toBe(true);
    expect(state.activePromise).toBe(transitionPromise);

    resolveTransition();

    await expect(runPromise).resolves.toBe(true);
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onFinally).toHaveBeenCalledTimes(1);
    expect(state.isTransitioning).toBe(false);
    expect(state.activePromise).toBeNull();
  });

  it("rethrows transition failures and still clears ownership", async () => {
    const state = createWorldmapChunkTransitionRuntimeState();
    const error = new Error("transition failed");

    await expect(
      runWorldmapChunkTransition({
        onResolved: vi.fn(() => true),
        state,
        transitionPromise: Promise.reject(error),
      }),
    ).rejects.toThrow("transition failed");

    expect(state.isTransitioning).toBe(false);
    expect(state.activePromise).toBeNull();
  });
});
