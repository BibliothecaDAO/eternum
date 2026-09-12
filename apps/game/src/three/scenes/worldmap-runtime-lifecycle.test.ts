import { describe, expect, it, vi } from "vitest";
import {
  applyWorldmapSwitchOffRuntimeState,
  invalidateWorldmapSwitchOffTransitionState,
} from "./worldmap-runtime-lifecycle";

describe("worldmap runtime lifecycle", () => {
  it("clears switch-off transient state and returns reset primitives", () => {
    const pinnedChunkKeys = new Set<string>(["8,8"]);
    const pinnedRenderAreas = new Set<string>(["8,8:render"]);

    const clearQueuedPrefetchStateSpy = vi.fn();
    const clearStreamingWorkSpy = vi.fn();

    const result = applyWorldmapSwitchOffRuntimeState({
      pinnedChunkKeys,
      pinnedRenderAreas,
      hydratedChunkRefreshes: new Set(),
      hydratedRefreshSuppressionAreaKeys: new Set(),
      clearStreamingWork: clearStreamingWorkSpy,
      clearQueuedPrefetchState: clearQueuedPrefetchStateSpy,
    });

    expect(clearStreamingWorkSpy).toHaveBeenCalledTimes(1);
    expect(clearQueuedPrefetchStateSpy).toHaveBeenCalledTimes(1);

    expect(pinnedChunkKeys.size).toBe(0);
    expect(pinnedRenderAreas.size).toBe(0);

    expect(result).toEqual({
      isSwitchedOff: true,
      currentChunk: "null",
      lastControlsCameraDistance: null,
    });
  });

  it("is idempotent with empty collections", () => {
    const clearQueuedPrefetchStateSpy = vi.fn();
    const clearStreamingWorkSpy = vi.fn();

    const result = applyWorldmapSwitchOffRuntimeState({
      pinnedChunkKeys: new Set(),
      pinnedRenderAreas: new Set(),
      hydratedChunkRefreshes: new Set(),
      hydratedRefreshSuppressionAreaKeys: new Set(),
      clearStreamingWork: clearStreamingWorkSpy,
      clearQueuedPrefetchState: clearQueuedPrefetchStateSpy,
    });

    expect(clearStreamingWorkSpy).toHaveBeenCalledTimes(1);
    expect(clearQueuedPrefetchStateSpy).toHaveBeenCalledTimes(1);
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
});
