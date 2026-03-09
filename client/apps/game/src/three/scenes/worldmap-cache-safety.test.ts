import { describe, expect, it } from "vitest";
import {
  hasSufficientSpectatorTileCoverage,
  shouldRejectCachedExploredTerrainSnapshot,
  shouldRejectCachedSpectatorTerrainSnapshot,
  shouldRejectCachedTerrainSnapshot,
} from "./worldmap-cache-safety";

describe("shouldRejectCachedTerrainSnapshot", () => {
  it("rejects completely empty cached terrain snapshots", () => {
    expect(
      shouldRejectCachedTerrainSnapshot({
        totalCachedTerrainInstances: 0,
        renderHexCapacity: 48 * 48,
        minCoverageFraction: 0.1,
      }),
    ).toBe(true);
  });

  it("rejects suspiciously sparse cached terrain snapshots", () => {
    expect(
      shouldRejectCachedTerrainSnapshot({
        totalCachedTerrainInstances: 50,
        renderHexCapacity: 48 * 48,
        minCoverageFraction: 0.1,
      }),
    ).toBe(true);
  });

  it("accepts healthy cached terrain snapshots", () => {
    expect(
      shouldRejectCachedTerrainSnapshot({
        totalCachedTerrainInstances: 1600,
        renderHexCapacity: 48 * 48,
        minCoverageFraction: 0.1,
      }),
    ).toBe(false);
  });

  it("clamps invalid thresholds safely", () => {
    expect(
      shouldRejectCachedTerrainSnapshot({
        totalCachedTerrainInstances: 1600,
        renderHexCapacity: 48 * 48,
        minCoverageFraction: -1,
      }),
    ).toBe(false);
    expect(
      shouldRejectCachedTerrainSnapshot({
        totalCachedTerrainInstances: 1600,
        renderHexCapacity: 48 * 48,
        minCoverageFraction: 2,
      }),
    ).toBe(true);
  });
});

describe("shouldRejectCachedExploredTerrainSnapshot", () => {
  it("does not reject when expected explored sample is too small", () => {
    expect(
      shouldRejectCachedExploredTerrainSnapshot({
        cachedExploredTerrainInstances: 5,
        expectedExploredTerrainInstances: 20,
        minRetentionFraction: 0.5,
        minExpectedExploredInstances: 64,
      }),
    ).toBe(false);
  });

  it("rejects when cached explored terrain falls well below expected retention", () => {
    expect(
      shouldRejectCachedExploredTerrainSnapshot({
        cachedExploredTerrainInstances: 40,
        expectedExploredTerrainInstances: 300,
        minRetentionFraction: 0.5,
        minExpectedExploredInstances: 64,
      }),
    ).toBe(true);
  });

  it("accepts when cached explored terrain retains expected coverage", () => {
    expect(
      shouldRejectCachedExploredTerrainSnapshot({
        cachedExploredTerrainInstances: 190,
        expectedExploredTerrainInstances: 300,
        minRetentionFraction: 0.5,
        minExpectedExploredInstances: 64,
      }),
    ).toBe(false);
  });
});

describe("hasSufficientSpectatorTileCoverage", () => {
  it("treats low spectator tile coverage as insufficient once the sample is large enough", () => {
    expect(
      hasSufficientSpectatorTileCoverage({
        resolvedTileInstances: 180,
        expectedVisibleTerrainInstances: 512,
        minCoverageFraction: 0.85,
        minExpectedVisibleTerrainInstances: 128,
      }),
    ).toBe(false);
  });

  it("accepts spectator coverage when the resolved tiles retain the configured fraction", () => {
    expect(
      hasSufficientSpectatorTileCoverage({
        resolvedTileInstances: 450,
        expectedVisibleTerrainInstances: 512,
        minCoverageFraction: 0.85,
        minExpectedVisibleTerrainInstances: 128,
      }),
    ).toBe(true);
  });

  it("does not block spectator hydration on tiny samples", () => {
    expect(
      hasSufficientSpectatorTileCoverage({
        resolvedTileInstances: 12,
        expectedVisibleTerrainInstances: 20,
        minCoverageFraction: 0.95,
        minExpectedVisibleTerrainInstances: 128,
      }),
    ).toBe(true);
  });
});

describe("shouldRejectCachedSpectatorTerrainSnapshot", () => {
  it("rejects spectator snapshots dominated by outlines", () => {
    expect(
      shouldRejectCachedSpectatorTerrainSnapshot({
        outlineTerrainInstances: 420,
        expectedVisibleTerrainInstances: 512,
        maxOutlineFraction: 0.1,
        minExpectedVisibleTerrainInstances: 128,
      }),
    ).toBe(true);
  });

  it("accepts spectator snapshots with limited outline coverage", () => {
    expect(
      shouldRejectCachedSpectatorTerrainSnapshot({
        outlineTerrainInstances: 24,
        expectedVisibleTerrainInstances: 512,
        maxOutlineFraction: 0.1,
        minExpectedVisibleTerrainInstances: 128,
      }),
    ).toBe(false);
  });

  it("does not reject spectator snapshots when the expected visible sample is too small", () => {
    expect(
      shouldRejectCachedSpectatorTerrainSnapshot({
        outlineTerrainInstances: 20,
        expectedVisibleTerrainInstances: 32,
        maxOutlineFraction: 0.05,
        minExpectedVisibleTerrainInstances: 128,
      }),
    ).toBe(false);
  });
});
