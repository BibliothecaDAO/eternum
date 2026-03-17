import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { shouldRejectCachedExploredTerrainSnapshot, shouldRejectCachedTerrainSnapshot } from "./worldmap-cache-safety";
import {
  isHexWithinTerrainPresentationBounds,
  resolveTerrainPresentationBounds,
} from "./worldmap-terrain-bounds-policy";
import { isHexWithinRenderBounds } from "../utils/chunk-geometry";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const worldmapPath = resolve(currentDir, "worldmap.tsx");
  return readFileSync(worldmapPath, "utf8");
}

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

describe("padded bounds prevent incorrect cache replay rejection", () => {
  it("current chunk replay is not rejected solely due to overly tight bounds visibility", () => {
    // A hex just outside the raw render bounds but within padded presentation bounds.
    // Raw bounds would classify it as offscreen; padded bounds correctly include it.
    const startRow = 0;
    const startCol = 0;
    const renderSize = { width: 10, height: 10 };
    const chunkSize = 10;

    // This hex is 1 unit outside the raw maxCol (raw maxCol = 9, hex at col 10).
    const edgeCol = 10;
    const edgeRow = 5;

    // Raw render bounds exclude it
    const rawIncludes = isHexWithinRenderBounds(edgeCol, edgeRow, startRow, startCol, renderSize, chunkSize);
    expect(rawIncludes).toBe(false);

    // Padded presentation bounds include it
    const paddedBounds = resolveTerrainPresentationBounds({ startRow, startCol, renderSize, chunkSize });
    const paddedIncludes = isHexWithinTerrainPresentationBounds(edgeCol, edgeRow, paddedBounds);
    expect(paddedIncludes).toBe(true);

    // Therefore, cache replay decisions using padded bounds would NOT reject
    // this hex as offscreen, preventing false cache invalidation.
  });

  it("worldmap cache replay does not early-return on cached bounds invisibility", () => {
    const source = readWorldmapSource();

    expect(source).not.toMatch(/if\s*\(bounds\?\.box\s*&&\s*!this\.visibilityManager\.isBoxVisible\(bounds\.box\)\)\s*\{\s*return false;\s*\}/s);
  });
});
