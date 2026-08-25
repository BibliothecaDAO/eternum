import { describe, expect, it, vi } from "vitest";

import { prepareWarpTravelChunkBounds } from "./warp-travel-chunk-bounds-preparation";

describe("prepareWarpTravelChunkBounds", () => {
  it("registers the target chunk and applies combined scene bounds when the previous chunk is available", () => {
    const computeChunkBounds = vi.fn((row: number, col: number) => `${row},${col}:bounds`);
    const registerChunk = vi.fn();
    const combineChunkBounds = vi.fn((previous: string, target: string) => `${previous}+${target}`);
    const applySceneChunkBounds = vi.fn();

    const targetBounds = prepareWarpTravelChunkBounds({
      targetChunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      hasFiniteOldChunkCoordinates: true,
      oldChunkCoordinates: [0, 0],
      computeChunkBounds,
      registerChunk,
      combineChunkBounds,
      applySceneChunkBounds,
    });

    expect(targetBounds).toBe("24,24:bounds");
    expect(computeChunkBounds).toHaveBeenCalledTimes(2);
    expect(computeChunkBounds).toHaveBeenNthCalledWith(1, 24, 24);
    expect(computeChunkBounds).toHaveBeenNthCalledWith(2, 0, 0);
    expect(registerChunk).toHaveBeenCalledWith("24,24", "24,24:bounds");
    expect(combineChunkBounds).toHaveBeenCalledWith("0,0:bounds", "24,24:bounds");
    expect(applySceneChunkBounds).toHaveBeenCalledWith("0,0:bounds+24,24:bounds");
  });

  it("applies the target chunk bounds directly when there is no previous chunk", () => {
    const computeChunkBounds = vi.fn((row: number, col: number) => `${row},${col}:bounds`);
    const registerChunk = vi.fn();
    const combineChunkBounds = vi.fn();
    const applySceneChunkBounds = vi.fn();

    const targetBounds = prepareWarpTravelChunkBounds({
      targetChunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      hasFiniteOldChunkCoordinates: false,
      oldChunkCoordinates: null,
      computeChunkBounds,
      registerChunk,
      combineChunkBounds,
      applySceneChunkBounds,
    });

    expect(targetBounds).toBe("24,24:bounds");
    expect(computeChunkBounds).toHaveBeenCalledTimes(1);
    expect(registerChunk).toHaveBeenCalledWith("24,24", "24,24:bounds");
    expect(combineChunkBounds).not.toHaveBeenCalled();
    expect(applySceneChunkBounds).toHaveBeenCalledWith("24,24:bounds");
  });
});
