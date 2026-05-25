import { describe, expect, it, vi } from "vitest";

import { prepareWorldmapChunkSwitchRuntime } from "./worldmap-chunk-switch-runtime";

describe("prepareWorldmapChunkSwitchRuntime", () => {
  it("forces aggressive refresh on reversal and invalidates surrounding terrain caches", () => {
    const prepareBounds = vi.fn();
    const invalidateTerrainCaches = vi.fn();
    const removeCachedMatricesForChunk = vi.fn();

    const result = prepareWorldmapChunkSwitchRuntime({
      chunkKey: "24,24",
      force: false,
      getSurroundingChunkKeys: vi.fn(() => ["0,24", "24,0"]),
      invalidateTerrainCaches,
      lastChunkSwitchMovement: { x: 12, z: 0 },
      lastChunkSwitchPosition: { x: 10, z: 10 },
      pinnedChunkKeys: new Set(["-24,24", "0,0"]),
      prepareBounds,
      removeCachedMatricesForChunk,
      startCol: 24,
      startRow: 24,
      switchPosition: { x: 0, z: 10 },
    });

    expect(result.effectiveForce).toBe(true);
    expect(result.reversalRefreshDecision.shouldForceRefresh).toBe(true);
    expect(result.previousPinnedChunks).toEqual(["-24,24", "0,0"]);
    expect(result.surroundingChunks).toEqual(["0,24", "24,0"]);
    expect(prepareBounds).toHaveBeenCalledWith({
      hasFiniteOldChunkCoordinates: false,
      oldChunkCoordinates: null,
      startCol: 24,
      startRow: 24,
      targetChunkKey: "24,24",
    });
    expect(invalidateTerrainCaches).toHaveBeenCalledWith("24,24", {
      includeSurroundingChunks: ["0,24", "24,0"],
      invalidateFetchAreas: true,
    });
    expect(removeCachedMatricesForChunk).not.toHaveBeenCalled();
  });

  it("removes only the target chunk cache when refresh is forced without reversal", () => {
    const removeCachedMatricesForChunk = vi.fn();

    const result = prepareWorldmapChunkSwitchRuntime({
      chunkKey: "48,48",
      force: true,
      getSurroundingChunkKeys: vi.fn(() => ["24,48"]),
      invalidateTerrainCaches: vi.fn(),
      lastChunkSwitchMovement: null,
      lastChunkSwitchPosition: null,
      pinnedChunkKeys: new Set<string>(),
      prepareBounds: vi.fn(),
      removeCachedMatricesForChunk,
      startCol: 48,
      startRow: 48,
      switchPosition: null,
    });

    expect(result.effectiveForce).toBe(true);
    expect(result.reversalRefreshDecision.shouldForceRefresh).toBe(false);
    expect(removeCachedMatricesForChunk).toHaveBeenCalledWith(48, 48);
  });

  it("passes finite old chunk coordinates into bounds preparation when current chunk is valid", () => {
    const prepareBounds = vi.fn();

    const result = prepareWorldmapChunkSwitchRuntime({
      chunkKey: "72,72",
      currentChunk: "24,48",
      force: false,
      getSurroundingChunkKeys: vi.fn(() => []),
      invalidateTerrainCaches: vi.fn(),
      lastChunkSwitchMovement: null,
      lastChunkSwitchPosition: null,
      pinnedChunkKeys: new Set(["24,48"]),
      prepareBounds,
      removeCachedMatricesForChunk: vi.fn(),
      startCol: 72,
      startRow: 72,
      switchPosition: null,
    });

    expect(result.oldChunk).toBe("24,48");
    expect(result.hasFiniteOldChunkCoordinates).toBe(true);
    expect(result.oldChunkCoordinates).toEqual([24, 48]);
    expect(prepareBounds).toHaveBeenCalledWith({
      hasFiniteOldChunkCoordinates: true,
      oldChunkCoordinates: [24, 48],
      startCol: 72,
      startRow: 72,
      targetChunkKey: "72,72",
    });
  });
});
