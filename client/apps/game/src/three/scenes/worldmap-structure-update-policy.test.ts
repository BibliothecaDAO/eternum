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
      shouldClearCache: false,
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
      shouldClearCache: false,
      shouldRefreshVisibleChunks: false,
      shouldUpdateTotalStructures: false,
    });
  });

  it("prefers full refresh path when structure count changed", () => {
    expect(
      resolveStructureTileUpdateActions({
        hasPositions: true,
        countChanged: true,
      }),
    ).toEqual({
      shouldScheduleTileRefresh: false,
      shouldClearCache: true,
      shouldRefreshVisibleChunks: true,
      shouldUpdateTotalStructures: true,
    });
  });
});
