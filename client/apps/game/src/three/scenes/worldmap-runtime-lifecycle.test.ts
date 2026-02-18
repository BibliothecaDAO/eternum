import { describe, expect, it, vi } from "vitest";
import { applyWorldmapSwitchOffRuntimeState } from "./worldmap-runtime-lifecycle";

describe("worldmap runtime lifecycle", () => {
  it("clears switch-off transient state and returns reset primitives", () => {
    const pendingArmyRemovals = new Map<number, string>([
      [101, "timeout-a"],
      [202, "timeout-b"],
    ]);
    const pendingArmyRemovalMeta = new Map<number, { scheduledAt: number }>([[101, { scheduledAt: Date.now() }]]);
    const deferredChunkRemovals = new Map<number, { reason: string }>([[101, { reason: "tile" }]]);
    const armyLastUpdateAt = new Map<number, number>([[101, Date.now()]]);
    const pendingArmyMovements = new Set<number>([101, 202]);
    const pendingArmyMovementStartedAt = new Map<number, number>([[101, Date.now()]]);
    const pendingArmyMovementFallbackTimeouts = new Map<number, string>([[101, "fallback-timeout"]]);
    const armyStructureOwners = new Map<number, number>([[101, 88]]);
    const fetchedChunks = new Set<string>(["8,8"]);
    const pendingChunks = new Map<string, Promise<boolean>>([["8,8", Promise.resolve(true)]]);
    const pinnedChunkKeys = new Set<string>(["8,8"]);
    const pinnedRenderAreas = new Set<string>(["8,8:render"]);

    const clearTimeoutSpy = vi.fn();
    const clearPendingArmyMovementSpy = vi.fn();
    const clearQueuedPrefetchStateSpy = vi.fn();

    const result = applyWorldmapSwitchOffRuntimeState({
      pendingArmyRemovals,
      pendingArmyRemovalMeta,
      deferredChunkRemovals,
      armyLastUpdateAt,
      pendingArmyMovements,
      pendingArmyMovementStartedAt,
      pendingArmyMovementFallbackTimeouts,
      armyStructureOwners,
      fetchedChunks,
      pendingChunks,
      pinnedChunkKeys,
      pinnedRenderAreas,
      clearTimeout: clearTimeoutSpy,
      clearPendingArmyMovement: clearPendingArmyMovementSpy,
      clearQueuedPrefetchState: clearQueuedPrefetchStateSpy,
    });

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(clearPendingArmyMovementSpy).toHaveBeenCalledTimes(2);
    expect(clearPendingArmyMovementSpy).toHaveBeenCalledWith(101);
    expect(clearPendingArmyMovementSpy).toHaveBeenCalledWith(202);
    expect(clearQueuedPrefetchStateSpy).toHaveBeenCalledTimes(1);

    expect(pendingArmyRemovals.size).toBe(0);
    expect(pendingArmyRemovalMeta.size).toBe(0);
    expect(deferredChunkRemovals.size).toBe(0);
    expect(armyLastUpdateAt.size).toBe(0);
    expect(pendingArmyMovements.size).toBe(0);
    expect(pendingArmyMovementStartedAt.size).toBe(0);
    expect(pendingArmyMovementFallbackTimeouts.size).toBe(0);
    expect(armyStructureOwners.size).toBe(0);
    expect(fetchedChunks.size).toBe(0);
    expect(pendingChunks.size).toBe(0);
    expect(pinnedChunkKeys.size).toBe(0);
    expect(pinnedRenderAreas.size).toBe(0);

    expect(result).toEqual({
      isSwitchedOff: true,
      toriiLoadingCounter: 0,
      currentChunk: "null",
      lastControlsCameraDistance: null,
    });
  });

  it("is idempotent with empty collections", () => {
    const clearTimeoutSpy = vi.fn();
    const clearPendingArmyMovementSpy = vi.fn();
    const clearQueuedPrefetchStateSpy = vi.fn();

    const result = applyWorldmapSwitchOffRuntimeState({
      pendingArmyRemovals: new Map(),
      pendingArmyRemovalMeta: new Map(),
      deferredChunkRemovals: new Map(),
      armyLastUpdateAt: new Map(),
      pendingArmyMovements: new Set(),
      pendingArmyMovementStartedAt: new Map(),
      pendingArmyMovementFallbackTimeouts: new Map(),
      armyStructureOwners: new Map(),
      fetchedChunks: new Set(),
      pendingChunks: new Map(),
      pinnedChunkKeys: new Set(),
      pinnedRenderAreas: new Set(),
      clearTimeout: clearTimeoutSpy,
      clearPendingArmyMovement: clearPendingArmyMovementSpy,
      clearQueuedPrefetchState: clearQueuedPrefetchStateSpy,
    });

    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    expect(clearPendingArmyMovementSpy).not.toHaveBeenCalled();
    expect(clearQueuedPrefetchStateSpy).toHaveBeenCalledTimes(1);
    expect(result.currentChunk).toBe("null");
    expect(result.isSwitchedOff).toBe(true);
  });
});
