import { describe, expect, it } from "vitest";
import { getChunkKeysContainingHexInRenderBounds, getRenderBounds } from "../utils/chunk-geometry";
import { getRenderOverlapChunkKeys, getRenderOverlapStrideRadius } from "./worldmap-chunk-neighbors";

const CHUNK_SIZE = 24;
const RENDER_SIZES = [32, 48, 64, 80, 96] as const;

describe("getRenderOverlapStrideRadius", () => {
  it.each([
    { size: 32, expectedRadius: 1 },
    { size: 48, expectedRadius: 1 },
    { size: 64, expectedRadius: 2 },
    { size: 80, expectedRadius: 3 },
    { size: 96, expectedRadius: 3 },
  ])("returns $expectedRadius for render size $size", ({ size, expectedRadius }) => {
    expect(getRenderOverlapStrideRadius(size, CHUNK_SIZE)).toBe(expectedRadius);
  });
});

describe("getRenderOverlapChunkKeys", () => {
  it.each(RENDER_SIZES)("derives stride-aligned overlap neighbors for render size %s", (size) => {
    const keys = getRenderOverlapChunkKeys({
      centerChunkKey: "0,0",
      renderSize: { width: size, height: size },
      chunkSize: CHUNK_SIZE,
    });

    const strideRadius = Math.floor((size - 1) / CHUNK_SIZE);
    const expectedSpan = strideRadius * 2 + 1;

    expect(keys).toHaveLength(expectedSpan * expectedSpan);
    expect(keys).toContain("0,0");
    expect(keys).toContain(`${-strideRadius * CHUNK_SIZE},${-strideRadius * CHUNK_SIZE}`);
    expect(keys).toContain(`${strideRadius * CHUNK_SIZE},${strideRadius * CHUNK_SIZE}`);

    keys.forEach((chunkKey) => {
      const [startRow, startCol] = chunkKey.split(",").map(Number);
      expect(Number.isFinite(startRow)).toBe(true);
      expect(Number.isFinite(startCol)).toBe(true);
      expect(Math.abs(startRow % CHUNK_SIZE)).toBe(0);
      expect(Math.abs(startCol % CHUNK_SIZE)).toBe(0);
    });
  });
});

describe("cache invalidation overlap behavior", () => {
  it.each(RENDER_SIZES)("captures right-edge overlap neighbors for render size %s", (size) => {
    const chunkKeys = getRenderOverlapChunkKeys({
      centerChunkKey: "0,0",
      renderSize: { width: size, height: size },
      chunkSize: CHUNK_SIZE,
    });

    const bounds = getRenderBounds(0, 0, { width: size, height: size }, CHUNK_SIZE);
    const overlaps = getChunkKeysContainingHexInRenderBounds({
      chunkKeys,
      col: bounds.maxCol,
      row: Math.floor((bounds.minRow + bounds.maxRow) / 2),
      renderSize: { width: size, height: size },
      chunkSize: CHUNK_SIZE,
    });

    expect(overlaps).toContain("0,0");
    expect(overlaps).toContain(`0,${CHUNK_SIZE}`);
    expect(overlaps.every((chunkKey) => chunkKeys.includes(chunkKey))).toBe(true);
  });
});
