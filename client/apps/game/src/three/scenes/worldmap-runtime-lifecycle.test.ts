import { describe, expect, it, vi } from "vitest";
import {
  applyWorldmapSwitchOffRuntimeState,
  invalidateWorldmapSwitchOffTransitionState,
  invalidateWorldmapPendingFetchGeneration,
  shouldApplyWorldmapFetchResult,
} from "./worldmap-runtime-lifecycle";
import { SceneName } from "../types";

describe("worldmap runtime lifecycle", () => {
  it("clears switch-off transient state and returns reset primitives", () => {
    const pendingArmyMovements = new Map<number, { movement?: { fallbackTimeout?: string } }>([
      [101, { movement: { fallbackTimeout: "fallback-timeout" } }],
      [202, { movement: {} }],
      // tx-only residue: movement already cleared, receipt still tracked.
      [303, {}],
    ]);
    const pinnedChunkKeys = new Set<string>(["8,8"]);
    const pinnedRenderAreas = new Set<string>(["8,8:render"]);

    const clearTimeoutSpy = vi.fn();
    const clearPendingArmyMovementSpy = vi.fn();
    const clearQueuedPrefetchStateSpy = vi.fn();
    const clearStreamingWorkSpy = vi.fn();
    const clearRenderAreaHydrationStateSpy = vi.fn();
    const invalidatePendingFetchesSpy = vi.fn();
    const releaseInactiveResourcesSpy = vi.fn();

    const result = applyWorldmapSwitchOffRuntimeState({
      pendingArmyMovements,
      clearRenderAreaHydrationState: clearRenderAreaHydrationStateSpy,
      pinnedChunkKeys,
      pinnedRenderAreas,
      hydratedChunkRefreshes: new Set(),
      hydratedRefreshSuppressionAreaKeys: new Set(),
      clearTimeout: clearTimeoutSpy,
      clearPendingArmyMovement: clearPendingArmyMovementSpy,
      clearStreamingWork: clearStreamingWorkSpy,
      clearQueuedPrefetchState: clearQueuedPrefetchStateSpy,
      releaseInactiveResources: releaseInactiveResourcesSpy,
      invalidatePendingFetches: invalidatePendingFetchesSpy,
    });

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledWith("fallback-timeout");
    expect(clearPendingArmyMovementSpy).toHaveBeenCalledTimes(3);
    expect(clearPendingArmyMovementSpy).toHaveBeenCalledWith(101);
    expect(clearPendingArmyMovementSpy).toHaveBeenCalledWith(202);
    expect(clearPendingArmyMovementSpy).toHaveBeenCalledWith(303);
    expect(clearStreamingWorkSpy).toHaveBeenCalledTimes(1);
    expect(clearQueuedPrefetchStateSpy).toHaveBeenCalledTimes(1);
    expect(clearRenderAreaHydrationStateSpy).toHaveBeenCalledTimes(1);
    expect(invalidatePendingFetchesSpy).toHaveBeenCalledTimes(1);
    expect(releaseInactiveResourcesSpy).not.toHaveBeenCalled();

    expect(pendingArmyMovements.size).toBe(0);
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
    const clearStreamingWorkSpy = vi.fn();
    const clearRenderAreaHydrationStateSpy = vi.fn();
    const invalidatePendingFetchesSpy = vi.fn();
    const releaseInactiveResourcesSpy = vi.fn();

    const result = applyWorldmapSwitchOffRuntimeState({
      pendingArmyMovements: new Map(),
      clearRenderAreaHydrationState: clearRenderAreaHydrationStateSpy,
      pinnedChunkKeys: new Set(),
      pinnedRenderAreas: new Set(),
      hydratedChunkRefreshes: new Set(),
      hydratedRefreshSuppressionAreaKeys: new Set(),
      clearTimeout: clearTimeoutSpy,
      clearPendingArmyMovement: clearPendingArmyMovementSpy,
      clearStreamingWork: clearStreamingWorkSpy,
      clearQueuedPrefetchState: clearQueuedPrefetchStateSpy,
      releaseInactiveResources: releaseInactiveResourcesSpy,
      invalidatePendingFetches: invalidatePendingFetchesSpy,
    });

    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    expect(clearPendingArmyMovementSpy).not.toHaveBeenCalled();
    expect(clearStreamingWorkSpy).toHaveBeenCalledTimes(1);
    expect(clearQueuedPrefetchStateSpy).toHaveBeenCalledTimes(1);
    expect(clearRenderAreaHydrationStateSpy).toHaveBeenCalledTimes(1);
    expect(invalidatePendingFetchesSpy).toHaveBeenCalledTimes(1);
    expect(releaseInactiveResourcesSpy).not.toHaveBeenCalled();
    expect(result.currentChunk).toBe("null");
    expect(result.isSwitchedOff).toBe(true);
  });

  it("invalidates chunk transition ownership when switching off", () => {
    const inFlightSwitch = Promise.resolve();
    const result = invalidateWorldmapSwitchOffTransitionState({
      chunkTransitionToken: 4,
      isChunkTransitioning: true,
      globalChunkSwitchPromise: inFlightSwitch,
    });

    expect(result).toEqual({
      chunkTransitionToken: 5,
      isChunkTransitioning: false,
      globalChunkSwitchPromise: null,
    });
  });

  it("clears hydrated refresh queues and sheds cache when switching to fast travel", () => {
    const hydratedChunkRefreshes = new Set<string>(["10,10"]);
    const hydratedRefreshSuppressionAreaKeys = new Set<string>(["10,10:render"]);
    const releaseInactiveResourcesSpy = vi.fn();
    const invalidatePendingFetchesSpy = vi.fn();

    applyWorldmapSwitchOffRuntimeState({
      pendingArmyMovements: new Map(),
      clearRenderAreaHydrationState: vi.fn(),
      pinnedChunkKeys: new Set(),
      pinnedRenderAreas: new Set(),
      hydratedChunkRefreshes,
      hydratedRefreshSuppressionAreaKeys,
      nextSceneName: SceneName.FastTravel,
      clearTimeout: vi.fn(),
      clearPendingArmyMovement: vi.fn(),
      clearStreamingWork: vi.fn(),
      clearQueuedPrefetchState: vi.fn(),
      releaseInactiveResources: releaseInactiveResourcesSpy,
      invalidatePendingFetches: invalidatePendingFetchesSpy,
    });

    expect(hydratedChunkRefreshes.size).toBe(0);
    expect(hydratedRefreshSuppressionAreaKeys.size).toBe(0);
    expect(releaseInactiveResourcesSpy).toHaveBeenCalledTimes(1);
    expect(invalidatePendingFetchesSpy).toHaveBeenCalledTimes(1);
  });

  it("invalidates stale fetch generations after switch-off", () => {
    const currentGeneration = 4;
    const nextGeneration = invalidateWorldmapPendingFetchGeneration(currentGeneration);

    expect(
      shouldApplyWorldmapFetchResult({
        fetchGeneration: currentGeneration,
        activeFetchGeneration: nextGeneration,
        fetchKey: "12,12:render",
        retainedRenderAreas: new Set(["12,12:render"]),
      }),
    ).toBe(false);

    expect(
      shouldApplyWorldmapFetchResult({
        fetchGeneration: nextGeneration,
        activeFetchGeneration: nextGeneration,
        fetchKey: "12,12:render",
        retainedRenderAreas: new Set(["12,12:render"]),
      }),
    ).toBe(true);
  });
});
