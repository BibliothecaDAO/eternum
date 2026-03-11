import { describe, expect, it } from "vitest";
import { shouldRejectCachedExploredTerrainSnapshot, shouldRejectCachedTerrainSnapshot } from "./worldmap-cache-safety";

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
