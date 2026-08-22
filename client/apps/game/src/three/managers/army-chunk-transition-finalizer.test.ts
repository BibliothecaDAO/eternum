import { describe, expect, it, vi } from "vitest";

import { finalizeArmyChunkTransition } from "./army-chunk-transition-finalizer";

describe("finalizeArmyChunkTransition", () => {
  it("releases the transition fence without draining when a newer transition wins", () => {
    const setTransitioning = vi.fn();
    const drainDeferredQueue = vi.fn();
    const drainPreCommitQueue = vi.fn();

    const finalized = finalizeArmyChunkTransition({
      isDestroyed: false,
      isWinningTransition: false,
      setTransitioning,
      drainDeferredQueue,
      drainPreCommitQueue,
    });

    expect(finalized).toBe(false);
    expect(setTransitioning).toHaveBeenCalledWith(false);
    expect(drainDeferredQueue).not.toHaveBeenCalled();
    expect(drainPreCommitQueue).not.toHaveBeenCalled();
  });

  it("releases and drains deferred work only after the winning transition commits", () => {
    const calls: string[] = [];

    const finalized = finalizeArmyChunkTransition({
      isDestroyed: false,
      isWinningTransition: true,
      setTransitioning: () => calls.push("released"),
      drainDeferredQueue: () => calls.push("deferred"),
      drainPreCommitQueue: () => calls.push("pre-commit"),
    });

    expect(finalized).toBe(true);
    expect(calls).toEqual(["released", "deferred", "pre-commit"]);
  });

  it("releases without draining when the manager is destroyed", () => {
    const setTransitioning = vi.fn();
    const drainDeferredQueue = vi.fn();

    finalizeArmyChunkTransition({
      isDestroyed: true,
      isWinningTransition: true,
      setTransitioning,
      drainDeferredQueue,
      drainPreCommitQueue: vi.fn(),
    });

    expect(setTransitioning).toHaveBeenCalledWith(false);
    expect(drainDeferredQueue).not.toHaveBeenCalled();
  });
});
