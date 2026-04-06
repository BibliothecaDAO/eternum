import { describe, expect, it } from "vitest";

import {
  resolveWorldmapChunkRefreshWorkPolicy,
  shouldDeferVisibleTerrainMutationForChunkWork,
  shouldBlockArmySelectionForChunkWork,
} from "./worldmap-chunk-work-policy";

describe("resolveWorldmapChunkRefreshWorkPolicy", () => {
  it("runs hydrated same-chunk refreshes in the background lane without invalidating fetch state", () => {
    expect(
      resolveWorldmapChunkRefreshWorkPolicy({
        currentChunk: "24,24",
        targetChunk: "24,24",
        force: true,
        reason: "hydrated_chunk",
      }),
    ).toEqual({
      useBackgroundLane: true,
      invalidateCurrentFetchArea: false,
      preserveSelection: true,
    });
  });

  it("runs forced default same-chunk refreshes in the background lane", () => {
    expect(
      resolveWorldmapChunkRefreshWorkPolicy({
        currentChunk: "24,24",
        targetChunk: "24,24",
        force: true,
        reason: "default",
      }),
    ).toEqual({
      useBackgroundLane: true,
      invalidateCurrentFetchArea: false,
      preserveSelection: true,
    });
  });

  it("invalidates fetched area for same-chunk visibility recovery", () => {
    expect(
      resolveWorldmapChunkRefreshWorkPolicy({
        currentChunk: "24,24",
        targetChunk: "24,24",
        force: true,
        reason: "visibility_recovery",
      }),
    ).toEqual({
      useBackgroundLane: true,
      invalidateCurrentFetchArea: true,
      preserveSelection: true,
    });
  });

  it("keeps cross-chunk work on the blocking lane", () => {
    expect(
      resolveWorldmapChunkRefreshWorkPolicy({
        currentChunk: "24,24",
        targetChunk: "48,24",
        force: true,
        reason: "default",
      }),
    ).toEqual({
      useBackgroundLane: false,
      invalidateCurrentFetchArea: false,
      preserveSelection: false,
    });
  });

  it("keeps initial setup on the blocking lane even when forced", () => {
    expect(
      resolveWorldmapChunkRefreshWorkPolicy({
        currentChunk: "null",
        targetChunk: "24,24",
        force: true,
        reason: "default",
      }),
    ).toEqual({
      useBackgroundLane: false,
      invalidateCurrentFetchArea: false,
      preserveSelection: false,
    });
  });
});

describe("shouldBlockArmySelectionForChunkWork", () => {
  it("blocks selection only for blocking chunk-switch authority", () => {
    expect(
      shouldBlockArmySelectionForChunkWork({
        hasBlockingChunkSwitch: true,
        hasBackgroundRefresh: false,
      }),
    ).toBe(true);
  });

  it("allows selection during background same-chunk refresh", () => {
    expect(
      shouldBlockArmySelectionForChunkWork({
        hasBlockingChunkSwitch: false,
        hasBackgroundRefresh: true,
      }),
    ).toBe(false);
  });
});

describe("shouldDeferVisibleTerrainMutationForChunkWork", () => {
  it("defers live terrain writes while same-chunk background refresh is active", () => {
    expect(
      shouldDeferVisibleTerrainMutationForChunkWork({
        hasBlockingChunkSwitch: false,
        hasBackgroundRefresh: true,
      }),
    ).toBe(true);
  });

  it("also defers live terrain writes during blocking chunk switches", () => {
    expect(
      shouldDeferVisibleTerrainMutationForChunkWork({
        hasBlockingChunkSwitch: true,
        hasBackgroundRefresh: false,
      }),
    ).toBe(true);
  });
});
