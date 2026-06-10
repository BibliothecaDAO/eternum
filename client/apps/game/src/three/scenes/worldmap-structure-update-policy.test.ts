import { describe, expect, it } from "vitest";
import { resolveStructureTileUpdateActions } from "./worldmap-structure-update-policy";

describe("resolveStructureTileUpdateActions", () => {
  it("schedules a tile refresh when positions changed and structure count is stable", () => {
    expect(
      resolveStructureTileUpdateActions({
        hasPositions: true,
        countChanged: false,
      }),
    ).toEqual({
      shouldScheduleTileRefresh: true,
      shouldInvalidateAffectedChunks: false,
      shouldRefreshVisibleChunks: false,
      shouldUpdateTotalStructures: false,
    });
  });

  it("does nothing when positions are missing and structure count is stable", () => {
    expect(
      resolveStructureTileUpdateActions({
        hasPositions: false,
        countChanged: false,
      }),
    ).toEqual({
      shouldScheduleTileRefresh: false,
      shouldInvalidateAffectedChunks: false,
      shouldRefreshVisibleChunks: false,
      shouldUpdateTotalStructures: false,
    });
  });

  // Phase 1.1: a structure count change must NOT flush the entire terrain matrix
  // cache + global pools (clearCache). It invalidates only the chunks overlapping
  // the affected structure hex and refreshes the visible chunks; the cached
  // terrain for every other chunk (and the pools) is preserved.
  it("invalidates only the affected chunks (no full cache flush) when structure count changed", () => {
    expect(
      resolveStructureTileUpdateActions({
        hasPositions: true,
        countChanged: true,
      }),
    ).toEqual({
      shouldScheduleTileRefresh: false,
      shouldInvalidateAffectedChunks: true,
      shouldRefreshVisibleChunks: true,
      shouldUpdateTotalStructures: true,
    });
  });

  it("still takes the count-change path when positions are missing", () => {
    expect(
      resolveStructureTileUpdateActions({
        hasPositions: false,
        countChanged: true,
      }),
    ).toEqual({
      shouldScheduleTileRefresh: false,
      shouldInvalidateAffectedChunks: true,
      shouldRefreshVisibleChunks: true,
      shouldUpdateTotalStructures: true,
    });
  });
});
