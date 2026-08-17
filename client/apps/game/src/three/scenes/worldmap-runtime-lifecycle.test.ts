import { describe, expect, it, vi } from "vitest";
import {
  applyWorldmapSwitchOffRuntimeState,
  invalidateWorldmapSwitchOffTransitionState,
} from "./worldmap-runtime-lifecycle";
import { SceneName } from "../types";

describe("worldmap runtime lifecycle", () => {
  it("clears switch-off transient state and returns reset primitives", () => {
    const pinnedChunkKeys = new Set<string>(["8,8"]);
    const pinnedRenderAreas = new Set<string>(["8,8:render"]);

    const clearQueuedPrefetchStateSpy = vi.fn();
    const clearStreamingWorkSpy = vi.fn();
    const releaseInactiveResourcesSpy = vi.fn();

    const result = applyWorldmapSwitchOffRuntimeState({
      pinnedChunkKeys,
      pinnedRenderAreas,
      hydratedChunkRefreshes: new Set(),
      hydratedRefreshSuppressionAreaKeys: new Set(),
      clearStreamingWork: clearStreamingWorkSpy,
      clearQueuedPrefetchState: clearQueuedPrefetchStateSpy,
      releaseInactiveResources: releaseInactiveResourcesSpy,
    });

    expect(clearStreamingWorkSpy).toHaveBeenCalledTimes(1);
    expect(clearQueuedPrefetchStateSpy).toHaveBeenCalledTimes(1);
    expect(releaseInactiveResourcesSpy).not.toHaveBeenCalled();

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
    const releaseInactiveResourcesSpy = vi.fn();

    const result = applyWorldmapSwitchOffRuntimeState({
      pinnedChunkKeys: new Set(),
      pinnedRenderAreas: new Set(),
      hydratedChunkRefreshes: new Set(),
      hydratedRefreshSuppressionAreaKeys: new Set(),
      clearStreamingWork: clearStreamingWorkSpy,
      clearQueuedPrefetchState: clearQueuedPrefetchStateSpy,
      releaseInactiveResources: releaseInactiveResourcesSpy,
    });

    expect(clearStreamingWorkSpy).toHaveBeenCalledTimes(1);
    expect(clearQueuedPrefetchStateSpy).toHaveBeenCalledTimes(1);
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

    applyWorldmapSwitchOffRuntimeState({
      pinnedChunkKeys: new Set(),
      pinnedRenderAreas: new Set(),
      hydratedChunkRefreshes,
      hydratedRefreshSuppressionAreaKeys,
      nextSceneName: SceneName.FastTravel,
      clearStreamingWork: vi.fn(),
      clearQueuedPrefetchState: vi.fn(),
      releaseInactiveResources: releaseInactiveResourcesSpy,
    });

    expect(hydratedChunkRefreshes.size).toBe(0);
    expect(hydratedRefreshSuppressionAreaKeys.size).toBe(0);
    expect(releaseInactiveResourcesSpy).toHaveBeenCalledTimes(1);
  });
});
