import { describe, expect, it, vi } from "vitest";

import { finalizeWarpTravelChunkSwitch } from "./warp-travel-chunk-switch-commit";
import { createControlledAsyncCall } from "./worldmap-test-harness";

describe("finalizeWarpTravelChunkSwitch", () => {
  it("rolls back to the previous chunk authority and restores visuals when hydration failed", async () => {
    const restorePreviousChunkVisuals = createControlledAsyncCall<[number, number, string, number], void>();
    const updateManagersForChunk = createControlledAsyncCall<[string, { force: boolean; transitionToken: number }], void>();
    const updatePinnedChunks = vi.fn();
    const unregisterChunk = vi.fn();
    const clearSceneChunkBounds = vi.fn();
    const forceVisibilityUpdate = vi.fn();
    const updateCurrentChunkBounds = vi.fn();
    const unregisterPreviousChunkOnNextFrame = vi.fn();

    const resultPromise = finalizeWarpTravelChunkSwitch({
      fetchSucceeded: false,
      isCurrentTransition: true,
      targetChunk: "24,24",
      previousChunk: "0,0",
      currentChunk: "0,0",
      previousPinnedChunks: ["0,0", "0,24"],
      hasFiniteOldChunkCoordinates: true,
      oldChunkCoordinates: [0, 0],
      startRow: 24,
      startCol: 24,
      force: false,
      transitionToken: 11,
      setCurrentChunk: vi.fn(),
      updatePinnedChunks,
      unregisterChunk,
      restorePreviousChunkVisuals: restorePreviousChunkVisuals.fn,
      clearSceneChunkBounds,
      forceVisibilityUpdate,
      updateCurrentChunkBounds,
      updateManagersForChunk: updateManagersForChunk.fn,
      unregisterPreviousChunkOnNextFrame,
    });

    expect(updatePinnedChunks).toHaveBeenCalledWith(["0,0", "0,24"]);
    expect(unregisterChunk).toHaveBeenCalledWith("24,24");
    expect(restorePreviousChunkVisuals.calls).toEqual([[0, 0, "0,0", 11]]);
    restorePreviousChunkVisuals.resolveNext();

    const result = await resultPromise;
    expect(result).toEqual({
      status: "rolled_back",
      nextCurrentChunk: "0,0",
    });
    expect(forceVisibilityUpdate).toHaveBeenCalledTimes(1);
    expect(updateManagersForChunk.calls).toEqual([]);
    expect(clearSceneChunkBounds).not.toHaveBeenCalled();
  });

  it("drops stale prepared chunks without committing manager updates", async () => {
    const updateManagersForChunk = createControlledAsyncCall<[string, { force: boolean; transitionToken: number }], void>();
    const unregisterChunk = vi.fn();

    const result = await finalizeWarpTravelChunkSwitch({
      fetchSucceeded: true,
      isCurrentTransition: false,
      targetChunk: "24,24",
      previousChunk: "0,0",
      currentChunk: "0,0",
      previousPinnedChunks: [],
      hasFiniteOldChunkCoordinates: false,
      oldChunkCoordinates: null,
      startRow: 24,
      startCol: 24,
      force: false,
      transitionToken: 13,
      setCurrentChunk: vi.fn(),
      updatePinnedChunks: vi.fn(),
      unregisterChunk,
      restorePreviousChunkVisuals: async () => undefined,
      clearSceneChunkBounds: vi.fn(),
      forceVisibilityUpdate: vi.fn(),
      updateCurrentChunkBounds: vi.fn(),
      updateManagersForChunk: updateManagersForChunk.fn,
      unregisterPreviousChunkOnNextFrame: vi.fn(),
    });

    expect(result).toEqual({
      status: "stale_dropped",
      nextCurrentChunk: "0,0",
    });
    expect(unregisterChunk).toHaveBeenCalledWith("24,24");
    expect(updateManagersForChunk.calls).toEqual([]);
  });

  it("commits the hydrated chunk, refreshes bounds, and fans out manager updates", async () => {
    const updateManagersForChunk = createControlledAsyncCall<[string, { force: boolean; transitionToken: number }], void>();
    const updateCurrentChunkBounds = vi.fn();
    const forceVisibilityUpdate = vi.fn();
    const unregisterPreviousChunkOnNextFrame = vi.fn();

    const resultPromise = finalizeWarpTravelChunkSwitch({
      fetchSucceeded: true,
      isCurrentTransition: true,
      targetChunk: "24,24",
      previousChunk: "0,0",
      currentChunk: "0,0",
      previousPinnedChunks: [],
      hasFiniteOldChunkCoordinates: false,
      oldChunkCoordinates: null,
      startRow: 24,
      startCol: 24,
      force: true,
      transitionToken: 17,
      setCurrentChunk: vi.fn(),
      updatePinnedChunks: vi.fn(),
      unregisterChunk: vi.fn(),
      restorePreviousChunkVisuals: async () => undefined,
      clearSceneChunkBounds: vi.fn(),
      forceVisibilityUpdate,
      updateCurrentChunkBounds,
      updateManagersForChunk: updateManagersForChunk.fn,
      unregisterPreviousChunkOnNextFrame,
    });

    expect(updateCurrentChunkBounds).toHaveBeenCalledWith(24, 24);
    expect(forceVisibilityUpdate).toHaveBeenCalledTimes(1);
    expect(updateManagersForChunk.calls).toEqual([["24,24", { force: true, transitionToken: 17 }]]);
    updateManagersForChunk.resolveNext();

    const result = await resultPromise;
    expect(result).toEqual({
      status: "committed",
      nextCurrentChunk: "24,24",
    });
    expect(unregisterPreviousChunkOnNextFrame).toHaveBeenCalledWith("0,0");
  });

  it("advances chunk authority before manager fanout on committed switches", async () => {
    let currentChunk = "0,0";
    const setCurrentChunk = vi.fn((chunkKey: string) => {
      currentChunk = chunkKey;
    });
    const updateManagersForChunk = vi.fn(async (chunkKey: string) => {
      expect(currentChunk).toBe(chunkKey);
    });

    await finalizeWarpTravelChunkSwitch({
      fetchSucceeded: true,
      isCurrentTransition: true,
      targetChunk: "24,24",
      previousChunk: "0,0",
      currentChunk,
      previousPinnedChunks: [],
      hasFiniteOldChunkCoordinates: false,
      oldChunkCoordinates: null,
      startRow: 24,
      startCol: 24,
      force: false,
      transitionToken: 19,
      setCurrentChunk,
      updatePinnedChunks: vi.fn(),
      unregisterChunk: vi.fn(),
      restorePreviousChunkVisuals: async () => undefined,
      clearSceneChunkBounds: vi.fn(),
      forceVisibilityUpdate: vi.fn(),
      updateCurrentChunkBounds: vi.fn(),
      updateManagersForChunk,
      unregisterPreviousChunkOnNextFrame: vi.fn(),
    });

    expect(updateManagersForChunk).toHaveBeenCalledWith("24,24", {
      force: false,
      transitionToken: 19,
    });
    expect(setCurrentChunk).toHaveBeenCalledTimes(1);
    expect(setCurrentChunk).toHaveBeenCalledWith("24,24");
  });
});
