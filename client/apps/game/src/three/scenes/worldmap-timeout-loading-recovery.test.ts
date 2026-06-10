// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { recoverWorldmapMapLoadingStateFromChunkTimeout } from "./worldmap-timeout-loading-recovery";

describe("worldmap timeout loading recovery", () => {
  it("clears stuck map loading when tile fetch times out", () => {
    const clearMapLoading = vi.fn();

    const nextCounter = recoverWorldmapMapLoadingStateFromChunkTimeout({
      phase: "tile_fetch",
      toriiLoadingCounter: 2,
      clearMapLoading,
    });

    expect(nextCounter).toBe(0);
    expect(clearMapLoading).toHaveBeenCalledTimes(1);
  });

  it("keeps map loading untouched for non-fetch chunk phases", () => {
    const clearMapLoading = vi.fn();

    const nextCounter = recoverWorldmapMapLoadingStateFromChunkTimeout({
      phase: "structure_hydration",
      toriiLoadingCounter: 2,
      clearMapLoading,
    });

    expect(nextCounter).toBe(2);
    expect(clearMapLoading).not.toHaveBeenCalled();
  });
});
