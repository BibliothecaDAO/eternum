import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { finalizeWarpTravelChunkSwitch } from "./warp-travel-chunk-switch-commit";
import { createControlledAsyncCall } from "./worldmap-test-harness";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const worldmapPath = resolve(currentDir, "worldmap.tsx");
  return readFileSync(worldmapPath, "utf8");
}

describe("finalizeWarpTravelChunkSwitch", () => {
  it("rolls back to the previous chunk authority and restores visuals when hydration failed", async () => {
    const restorePreviousChunkVisuals = createControlledAsyncCall<[number, number, string, number], void>();
    const scheduleManagerCatchUp = createControlledAsyncCall<
      [string, { force: boolean; transitionToken: number }],
      void
    >();
    const commitPreparedTerrain = vi.fn();
    const updatePinnedChunks = vi.fn();
    const unregisterChunk = vi.fn();
    const clearSceneChunkBounds = vi.fn();
    const forceVisibilityUpdate = vi.fn();
    const updateCurrentChunkBounds = vi.fn();
    const unregisterPreviousChunkOnNextFrame = vi.fn();

    const resultPromise = finalizeWarpTravelChunkSwitch({
      projectionSyncSucceeded: false,
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
      preparedTerrain: { chunkKey: "24,24" },
      commitPreparedTerrain,
      updatePinnedChunks,
      unregisterChunk,
      restorePreviousChunkVisuals: restorePreviousChunkVisuals.fn,
      clearSceneChunkBounds,
      forceVisibilityUpdate,
      updateCurrentChunkBounds,

      scheduleManagerCatchUp: scheduleManagerCatchUp.fn,
      unregisterPreviousChunkOnNextFrame,
    });

    expect(updatePinnedChunks).toHaveBeenCalledWith(["0,0", "0,24"]);
    expect(unregisterChunk).toHaveBeenCalledWith("24,24");
    expect(restorePreviousChunkVisuals.calls).toEqual([[0, 0, "0,0", 11]]);
    restorePreviousChunkVisuals.resolveNext();

    const result = await resultPromise;
    expect(result).toEqual({
      status: "rolled_back",
    });
    expect(commitPreparedTerrain).not.toHaveBeenCalled();
    expect(forceVisibilityUpdate).toHaveBeenCalledTimes(1);
    expect(scheduleManagerCatchUp.calls).toEqual([]);
    expect(clearSceneChunkBounds).not.toHaveBeenCalled();
  });

  it("drops stale prepared chunks without committing manager updates", async () => {
    const scheduleManagerCatchUp = createControlledAsyncCall<
      [string, { force: boolean; transitionToken: number }],
      void
    >();
    const commitPreparedTerrain = vi.fn();
    const unregisterChunk = vi.fn();

    const result = await finalizeWarpTravelChunkSwitch({
      projectionSyncSucceeded: true,
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
      preparedTerrain: { chunkKey: "24,24" },
      commitPreparedTerrain,
      updatePinnedChunks: vi.fn(),
      unregisterChunk,
      restorePreviousChunkVisuals: async () => undefined,
      clearSceneChunkBounds: vi.fn(),
      forceVisibilityUpdate: vi.fn(),
      updateCurrentChunkBounds: vi.fn(),

      scheduleManagerCatchUp: scheduleManagerCatchUp.fn,
      unregisterPreviousChunkOnNextFrame: vi.fn(),
    });

    expect(result).toEqual({
      status: "stale_dropped",
    });
    expect(commitPreparedTerrain).not.toHaveBeenCalled();
    expect(unregisterChunk).toHaveBeenCalledWith("24,24");
    expect(scheduleManagerCatchUp.calls).toEqual([]);
  });

  // Phase 2.2: prepared terrain holds pooled InstancedBufferAttributes. On rollback
  // and stale-drop the terrain is neither applied (which would transfer ownership to
  // the matrix cache) nor disposed, leaking the pooled attributes permanently.
  it("disposes prepared terrain on rollback instead of leaking the pooled attributes", async () => {
    const commitPreparedTerrain = vi.fn();
    const disposePreparedTerrain = vi.fn();
    const preparedTerrain = { chunkKey: "24,24" };

    const result = await finalizeWarpTravelChunkSwitch({
      projectionSyncSucceeded: false,
      isCurrentTransition: true,
      targetChunk: "24,24",
      previousChunk: "",
      currentChunk: "0,0",
      previousPinnedChunks: [],
      hasFiniteOldChunkCoordinates: false,
      oldChunkCoordinates: null,
      startRow: 24,
      startCol: 24,
      force: false,
      transitionToken: 31,
      preparedTerrain,
      commitPreparedTerrain,
      disposePreparedTerrain,
      updatePinnedChunks: vi.fn(),
      unregisterChunk: vi.fn(),
      restorePreviousChunkVisuals: async () => undefined,
      clearSceneChunkBounds: vi.fn(),
      forceVisibilityUpdate: vi.fn(),
      updateCurrentChunkBounds: vi.fn(),
      scheduleManagerCatchUp: vi.fn(),
      unregisterPreviousChunkOnNextFrame: vi.fn(),
    });

    expect(result).toEqual({ status: "rolled_back" });
    expect(commitPreparedTerrain).not.toHaveBeenCalled();
    expect(disposePreparedTerrain).toHaveBeenCalledWith(preparedTerrain);
  });

  it("disposes prepared terrain on stale drop instead of leaking the pooled attributes", async () => {
    const commitPreparedTerrain = vi.fn();
    const disposePreparedTerrain = vi.fn();
    const preparedTerrain = { chunkKey: "24,24" };

    const result = await finalizeWarpTravelChunkSwitch({
      projectionSyncSucceeded: true,
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
      transitionToken: 33,
      preparedTerrain,
      commitPreparedTerrain,
      disposePreparedTerrain,
      updatePinnedChunks: vi.fn(),
      unregisterChunk: vi.fn(),
      restorePreviousChunkVisuals: async () => undefined,
      clearSceneChunkBounds: vi.fn(),
      forceVisibilityUpdate: vi.fn(),
      updateCurrentChunkBounds: vi.fn(),
      scheduleManagerCatchUp: vi.fn(),
      unregisterPreviousChunkOnNextFrame: vi.fn(),
    });

    expect(result).toEqual({ status: "stale_dropped" });
    expect(commitPreparedTerrain).not.toHaveBeenCalled();
    expect(disposePreparedTerrain).toHaveBeenCalledWith(preparedTerrain);
  });

  it("applies (does not dispose) prepared terrain on a committed switch", async () => {
    const commitPreparedTerrain = vi.fn(() => 36);
    const disposePreparedTerrain = vi.fn();
    const scheduleManagerCatchUp = vi.fn();
    const preparedTerrain = { chunkKey: "24,24" };

    const result = await finalizeWarpTravelChunkSwitch({
      projectionSyncSucceeded: true,
      isCurrentTransition: true,
      targetChunk: "24,24",
      previousChunk: "0,0",
      currentChunk: "0,0",
      previousPinnedChunks: [],
      hasFiniteOldChunkCoordinates: false,
      oldChunkCoordinates: null,
      startRow: 24,
      startCol: 24,
      force: false,
      transitionToken: 35,
      preparedTerrain,
      commitPreparedTerrain,
      disposePreparedTerrain,
      updatePinnedChunks: vi.fn(),
      unregisterChunk: vi.fn(),
      restorePreviousChunkVisuals: async () => undefined,
      clearSceneChunkBounds: vi.fn(),
      forceVisibilityUpdate: vi.fn(),
      updateCurrentChunkBounds: vi.fn(),
      scheduleManagerCatchUp,
      unregisterPreviousChunkOnNextFrame: vi.fn(),
    });

    expect(result).toEqual({ status: "committed" });
    expect(commitPreparedTerrain).toHaveBeenCalledWith(preparedTerrain);
    expect(disposePreparedTerrain).not.toHaveBeenCalled();
    expect(scheduleManagerCatchUp).toHaveBeenCalledWith("24,24", { force: false, transitionToken: 36 });
  });

  it("skips every post-commit effect when the queued terrain commit loses ownership", async () => {
    const commitPreparedTerrain = createControlledAsyncCall<[unknown], boolean>();
    const updateCurrentChunkBounds = vi.fn();
    const forceVisibilityUpdate = vi.fn();
    const scheduleManagerCatchUp = vi.fn();
    const unregisterPreviousChunkOnNextFrame = vi.fn();

    const result = finalizeWarpTravelChunkSwitch({
      projectionSyncSucceeded: true,
      isCurrentTransition: true,
      targetChunk: "24,24",
      previousChunk: "0,0",
      currentChunk: "0,0",
      previousPinnedChunks: [],
      hasFiniteOldChunkCoordinates: false,
      oldChunkCoordinates: null,
      startRow: 24,
      startCol: 24,
      force: false,
      transitionToken: 36,
      preparedTerrain: { chunkKey: "24,24" },
      commitPreparedTerrain: commitPreparedTerrain.fn,
      updatePinnedChunks: vi.fn(),
      unregisterChunk: vi.fn(),
      restorePreviousChunkVisuals: async () => undefined,
      clearSceneChunkBounds: vi.fn(),
      forceVisibilityUpdate,
      updateCurrentChunkBounds,
      scheduleManagerCatchUp,
      unregisterPreviousChunkOnNextFrame,
    });

    expect(commitPreparedTerrain.calls).toEqual([[{ chunkKey: "24,24" }]]);
    commitPreparedTerrain.resolveNext(false);

    await expect(result).resolves.toEqual({ status: "stale_dropped" });
    expect(updateCurrentChunkBounds).not.toHaveBeenCalled();
    expect(forceVisibilityUpdate).not.toHaveBeenCalled();
    expect(scheduleManagerCatchUp).not.toHaveBeenCalled();
    expect(unregisterPreviousChunkOnNextFrame).not.toHaveBeenCalled();
  });

  it("fails loudly when successful projection sync returns no prepared terrain", async () => {
    const commitPreparedTerrain = vi.fn();
    const updateCurrentChunkBounds = vi.fn();
    const forceVisibilityUpdate = vi.fn();
    const scheduleManagerCatchUp = vi.fn();

    const result = finalizeWarpTravelChunkSwitch({
      projectionSyncSucceeded: true,
      isCurrentTransition: true,
      targetChunk: "24,24",
      previousChunk: "0,0",
      currentChunk: "0,0",
      previousPinnedChunks: [],
      hasFiniteOldChunkCoordinates: false,
      oldChunkCoordinates: null,
      startRow: 24,
      startCol: 24,
      force: false,
      transitionToken: 37,
      preparedTerrain: null,
      commitPreparedTerrain,
      updatePinnedChunks: vi.fn(),
      unregisterChunk: vi.fn(),
      restorePreviousChunkVisuals: async () => undefined,
      clearSceneChunkBounds: vi.fn(),
      forceVisibilityUpdate,
      updateCurrentChunkBounds,
      scheduleManagerCatchUp,
      unregisterPreviousChunkOnNextFrame: vi.fn(),
    });

    await expect(result).rejects.toThrow("Chunk 24,24 synchronized without prepared terrain");
    expect(commitPreparedTerrain).not.toHaveBeenCalled();
    expect(updateCurrentChunkBounds).not.toHaveBeenCalled();
    expect(forceVisibilityUpdate).not.toHaveBeenCalled();
    expect(scheduleManagerCatchUp).not.toHaveBeenCalled();
  });

  it("commits prepared terrain before deferred manager catch-up completes", async () => {
    const managerCatchUp = createControlledAsyncCall<[string, { force: boolean; transitionToken: number }], void>();
    const phaseOrder: string[] = [];
    const commitPreparedTerrain = vi.fn(() => {
      phaseOrder.push("authority");
      phaseOrder.push("terrain");
      return true;
    });
    const updateCurrentChunkBounds = vi.fn();
    const forceVisibilityUpdate = vi.fn();
    const unregisterPreviousChunkOnNextFrame = vi.fn();
    const scheduleManagerCatchUp = vi.fn((chunkKey: string, options: { force: boolean; transitionToken: number }) => {
      phaseOrder.push("manager-scheduled");
      void managerCatchUp.fn(chunkKey, options);
    });

    const resultPromise = finalizeWarpTravelChunkSwitch({
      projectionSyncSucceeded: true,
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
      preparedTerrain: { chunkKey: "24,24" },
      commitPreparedTerrain,
      updatePinnedChunks: vi.fn(),
      unregisterChunk: vi.fn(),
      restorePreviousChunkVisuals: async () => undefined,
      clearSceneChunkBounds: vi.fn(),
      forceVisibilityUpdate: vi.fn(() => {
        phaseOrder.push("visibility");
        forceVisibilityUpdate();
      }),
      updateCurrentChunkBounds: vi.fn((startRow: number, startCol: number) => {
        phaseOrder.push(`bounds:${startRow},${startCol}`);
        updateCurrentChunkBounds(startRow, startCol);
      }),
      scheduleManagerCatchUp,
      unregisterPreviousChunkOnNextFrame,
    });

    await expect(resultPromise).resolves.toEqual({
      status: "committed",
    });
    expect(updateCurrentChunkBounds).toHaveBeenCalledWith(24, 24);
    expect(forceVisibilityUpdate).toHaveBeenCalledTimes(1);
    expect(scheduleManagerCatchUp).toHaveBeenCalledWith("24,24", { force: true, transitionToken: 17 });
    expect(managerCatchUp.calls).toEqual([["24,24", { force: true, transitionToken: 17 }]]);
    expect(phaseOrder).toEqual(["authority", "terrain", "bounds:24,24", "visibility", "manager-scheduled"]);

    managerCatchUp.resolveNext();
    await Promise.resolve();
    expect(unregisterPreviousChunkOnNextFrame).toHaveBeenCalledWith("0,0");
  });

  it("keeps manager scheduling after visibility work so the visible commit can await critical convergence later", async () => {
    const phaseOrder: string[] = [];

    await finalizeWarpTravelChunkSwitch({
      projectionSyncSucceeded: true,
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
      transitionToken: 23,
      preparedTerrain: { chunkKey: "24,24" },
      commitPreparedTerrain: vi.fn(() => {
        phaseOrder.push("authority");
        phaseOrder.push("terrain");
        return true;
      }),
      updatePinnedChunks: vi.fn(),
      unregisterChunk: vi.fn(),
      restorePreviousChunkVisuals: async () => undefined,
      clearSceneChunkBounds: vi.fn(),
      forceVisibilityUpdate: vi.fn(() => {
        phaseOrder.push("visibility");
      }),
      updateCurrentChunkBounds: vi.fn(() => {
        phaseOrder.push("bounds");
      }),
      scheduleManagerCatchUp: vi.fn(() => {
        phaseOrder.push("critical-manager-catch-up");
        phaseOrder.push("deferred-non-critical-scheduled");
      }),
      unregisterPreviousChunkOnNextFrame: vi.fn(),
    });

    expect(phaseOrder).toEqual([
      "authority",
      "terrain",
      "bounds",
      "visibility",
      "critical-manager-catch-up",
      "deferred-non-critical-scheduled",
    ]);
  });

  it("advances chunk authority before manager fanout on committed switches", async () => {
    let currentChunk = "0,0";
    const commitPreparedTerrain = vi.fn(() => {
      const chunkKey = "24,24";
      currentChunk = chunkKey;
      return true;
    });
    const scheduleManagerCatchUp = vi.fn(async (chunkKey: string) => {
      expect(currentChunk).toBe(chunkKey);
    });

    await finalizeWarpTravelChunkSwitch({
      projectionSyncSucceeded: true,
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
      preparedTerrain: { chunkKey: "24,24" },
      commitPreparedTerrain,
      updatePinnedChunks: vi.fn(),
      unregisterChunk: vi.fn(),
      restorePreviousChunkVisuals: async () => undefined,
      clearSceneChunkBounds: vi.fn(),
      forceVisibilityUpdate: vi.fn(),
      updateCurrentChunkBounds: vi.fn(),

      scheduleManagerCatchUp,
      unregisterPreviousChunkOnNextFrame: vi.fn(),
    });

    expect(scheduleManagerCatchUp).toHaveBeenCalledWith("24,24", {
      force: false,
      transitionToken: 19,
    });
    expect(commitPreparedTerrain).toHaveBeenCalledTimes(1);
  });

  it("keeps committed chunk authority ownership inside the finalize callback path", () => {
    const source = readWorldmapSource();

    expect(source).not.toMatch(/this\.currentChunk = finalizeResult\.nextCurrentChunk/);
  });
});
