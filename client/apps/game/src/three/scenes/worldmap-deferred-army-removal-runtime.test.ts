import { describe, expect, it, vi } from "vitest";

import { retryDeferredWorldmapArmyRemovals } from "./worldmap-deferred-army-removal-runtime";

describe("retryDeferredWorldmapArmyRemovals", () => {
  it("does nothing when there are no deferred removals", () => {
    const deferredChunkRemovals = new Map<number, { reason: "tile" | "zero"; scheduledAt: number }>();

    const retriedCount = retryDeferredWorldmapArmyRemovals({
      deferredChunkRemovals,
      onRecoveredArmy: vi.fn(),
      onRetryRemoval: vi.fn(),
      resolveLastTileSyncAt: vi.fn(() => 0),
    });

    expect(retriedCount).toBe(0);
  });

  it("restores armies whose tile sync is newer than the deferred removal timestamp", () => {
    const onRecoveredArmy = vi.fn();
    const onRetryRemoval = vi.fn();
    const deferredChunkRemovals = new Map<number, { reason: "tile" | "zero"; scheduledAt: number }>([
      [7, { reason: "tile", scheduledAt: 100 }],
    ]);

    const retriedCount = retryDeferredWorldmapArmyRemovals({
      deferredChunkRemovals,
      onRecoveredArmy,
      onRetryRemoval,
      resolveLastTileSyncAt: (entityId) => (entityId === 7 ? 150 : 0),
    });

    expect(retriedCount).toBe(1);
    expect(deferredChunkRemovals.size).toBe(0);
    expect(onRecoveredArmy).toHaveBeenCalledWith(7);
    expect(onRetryRemoval).not.toHaveBeenCalled();
  });

  it("requeues removals when no newer tile sync has arrived", () => {
    const onRecoveredArmy = vi.fn();
    const onRetryRemoval = vi.fn();
    const deferredChunkRemovals = new Map<number, { reason: "tile" | "zero"; scheduledAt: number }>([
      [9, { reason: "zero", scheduledAt: 200 }],
    ]);

    const retriedCount = retryDeferredWorldmapArmyRemovals({
      deferredChunkRemovals,
      onRecoveredArmy,
      onRetryRemoval,
      resolveLastTileSyncAt: () => 150,
    });

    expect(retriedCount).toBe(1);
    expect(deferredChunkRemovals.size).toBe(0);
    expect(onRecoveredArmy).not.toHaveBeenCalled();
    expect(onRetryRemoval).toHaveBeenCalledWith(9, "zero");
  });
});
