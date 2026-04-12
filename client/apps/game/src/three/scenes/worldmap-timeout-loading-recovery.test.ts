// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { recoverWorldmapMapLoadingStateFromChunkTimeout } from "./worldmap-timeout-loading-recovery";

describe("worldmap timeout loading recovery", () => {
  it("clears stuck map loading when tile fetch times out", () => {
    const clearMapLoading = vi.fn();

    const nextCounter = recoverWorldmapMapLoadingStateFromChunkTimeout({
      phase: "tile_fetch",
      keepMapLoadingVisible: false,
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
      keepMapLoadingVisible: false,
      toriiLoadingCounter: 2,
      clearMapLoading,
    });

    expect(nextCounter).toBe(2);
    expect(clearMapLoading).not.toHaveBeenCalled();
  });

  it("does not hide map loading when zoom refresh loading is still active", () => {
    const clearMapLoading = vi.fn();

    const nextCounter = recoverWorldmapMapLoadingStateFromChunkTimeout({
      phase: "tile_fetch",
      keepMapLoadingVisible: true,
      toriiLoadingCounter: 2,
      clearMapLoading,
    });

    expect(nextCounter).toBe(0);
    expect(clearMapLoading).not.toHaveBeenCalled();
  });
});
