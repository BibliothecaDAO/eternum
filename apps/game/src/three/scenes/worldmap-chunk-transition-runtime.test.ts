import { describe, expect, it, vi } from "vitest";

import {
  createWorldmapChunkTransitionRuntimeState,
  resolveWorldmapChunkTransitionTimeoutRecovery,
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
    expect(state.activePromise).not.toBeNull();
    expect(state.activePromise).not.toBe(transitionPromise);

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

  it("invokes onHardTimeout and releases ownership when the transition exceeds hardTimeoutMs", async () => {
    vi.useFakeTimers();
    try {
      const state = createWorldmapChunkTransitionRuntimeState();
      // Never resolves during the test.
      const transitionPromise = new Promise<void>(() => {});
      const onResolved = vi.fn(() => true);
      const onHardTimeout = vi.fn(() => false);
      const onFinally = vi.fn();

      const runPromise = runWorldmapChunkTransition({
        hardTimeoutMs: 1_000,
        onFinally,
        onHardTimeout,
        onResolved,
        state,
        transitionPromise,
        yieldFrame: () => Promise.resolve(),
      });

      // Let onTransitionStart + yieldFrame microtasks run.
      await Promise.resolve();
      await Promise.resolve();

      expect(state.isTransitioning).toBe(true);
      expect(state.activePromise).not.toBeNull();
      expect(state.activePromise).not.toBe(transitionPromise);

      vi.advanceTimersByTime(1_000);

      await expect(runPromise).resolves.toBe(false);
      expect(onHardTimeout).toHaveBeenCalledWith({ timeoutMs: 1_000 });
      expect(onResolved).not.toHaveBeenCalled();
      expect(onFinally).toHaveBeenCalledTimes(1);
      expect(state.isTransitioning).toBe(false);
      expect(state.activePromise).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("exposes timeout-bounded ownership to callers waiting on the active transition", async () => {
    vi.useFakeTimers();
    try {
      const state = createWorldmapChunkTransitionRuntimeState();
      const transitionPromise = new Promise<void>(() => {});

      const runPromise = runWorldmapChunkTransition({
        hardTimeoutMs: 1_000,
        onHardTimeout: vi.fn(() => false),
        onResolved: vi.fn(() => true),
        state,
        transitionPromise,
        yieldFrame: () => Promise.resolve(),
      });

      await Promise.resolve();
      await Promise.resolve();

      let waiterSettled = false;
      const activeTransition = state.activePromise;
      void activeTransition?.then(() => {
        waiterSettled = true;
      });

      vi.advanceTimersByTime(1_000);

      await expect(runPromise).resolves.toBe(false);
      await Promise.resolve();
      expect(waiterSettled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("prefers the transition result when it resolves before hardTimeoutMs elapses", async () => {
    vi.useFakeTimers();
    try {
      const state = createWorldmapChunkTransitionRuntimeState();
      let resolveTransition!: () => void;
      const transitionPromise = new Promise<void>((resolve) => {
        resolveTransition = resolve;
      });
      const onResolved = vi.fn(() => true);
      const onHardTimeout = vi.fn(() => false);

      const runPromise = runWorldmapChunkTransition({
        hardTimeoutMs: 60_000,
        onHardTimeout,
        onResolved,
        state,
        transitionPromise,
        yieldFrame: () => Promise.resolve(),
      });

      resolveTransition();

      await expect(runPromise).resolves.toBe(true);
      expect(onResolved).toHaveBeenCalledTimes(1);
      expect(onHardTimeout).not.toHaveBeenCalled();
      expect(state.isTransitioning).toBe(false);
      expect(state.activePromise).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes the transition commit result to the resolved handler", async () => {
    const state = createWorldmapChunkTransitionRuntimeState();
    const onResolved = vi.fn((committed: boolean) => committed);

    const result = await runWorldmapChunkTransition({
      onResolved,
      state,
      transitionPromise: Promise.resolve(false),
      yieldFrame: () => Promise.resolve(),
    });

    expect(result).toBe(false);
    expect(onResolved).toHaveBeenCalledWith(false);
  });

  it("swallows a transition rejection that lands after the hard timeout without unhandled rejection", async () => {
    vi.useFakeTimers();
    const rejection = new Error("late rejection");
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    try {
      const state = createWorldmapChunkTransitionRuntimeState();
      let rejectTransition!: (error: unknown) => void;
      const transitionPromise = new Promise<void>((_, reject) => {
        rejectTransition = reject;
      });
      const onHardTimeout = vi.fn(() => false);

      const runPromise = runWorldmapChunkTransition({
        hardTimeoutMs: 1_000,
        onHardTimeout,
        onResolved: vi.fn(() => true),
        state,
        transitionPromise,
        yieldFrame: () => Promise.resolve(),
      });

      await Promise.resolve();
      await Promise.resolve();

      vi.advanceTimersByTime(1_000);
      await expect(runPromise).resolves.toBe(false);

      rejectTransition(rejection);
      await Promise.resolve();
      await Promise.resolve();

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
      vi.useRealTimers();
    }
  });

  it("advances the transition token when the active transition hard-times out", () => {
    expect(
      resolveWorldmapChunkTransitionTimeoutRecovery({
        currentTransitionToken: 7,
        timedOutTransitionToken: 7,
      }),
    ).toEqual({
      recoveryTransitionToken: 8,
      shouldInvalidateTimedOutTransition: true,
    });
  });

  it("keeps the current transition token when an older transition times out late", () => {
    expect(
      resolveWorldmapChunkTransitionTimeoutRecovery({
        currentTransitionToken: 9,
        timedOutTransitionToken: 7,
      }),
    ).toEqual({
      recoveryTransitionToken: 9,
      shouldInvalidateTimedOutTransition: false,
    });
  });
});
