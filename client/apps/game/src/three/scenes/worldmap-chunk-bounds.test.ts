import { describe, expect, it } from "vitest";
import { getRenderBounds } from "../utils/chunk-geometry";
import {
  getRenderAreaKeyForChunk,
  getRenderFetchBoundsForArea,
  getRenderFetchBoundsForChunk,
} from "./worldmap-chunk-bounds";

describe("getRenderFetchBoundsForChunk", () => {
  it("matches canonical getRenderBounds for representative chunk/render-size combinations", () => {
    const cases = [
      { startRow: 0, startCol: 0, renderSize: { width: 48, height: 48 }, chunkSize: 24 },
      { startRow: 0, startCol: 0, renderSize: { width: 49, height: 49 }, chunkSize: 24 },
      { startRow: 48, startCol: -24, renderSize: { width: 81, height: 65 }, chunkSize: 24 },
    ];

    cases.forEach(({ startRow, startCol, renderSize, chunkSize }) => {
      expect(getRenderFetchBoundsForChunk(`${startRow},${startCol}`, renderSize, chunkSize)).toEqual(
        getRenderBounds(startRow, startCol, renderSize, chunkSize),
      );
    });
  });
});

describe("getRenderAreaKeyForChunk", () => {
  it("maps a chunk key to its canonical torii super-area key", () => {
    expect(getRenderAreaKeyForChunk("48,72", 24, 3)).toBe("0,72");
    expect(getRenderAreaKeyForChunk("72,120", 24, 3)).toBe("72,72");
  });
});

describe("getRenderFetchBoundsForArea", () => {
  it("matches unioned canonical chunk bounds for 2x2 super-area windows", () => {
    const chunkSize = 24;
    const superAreaStrides = 2;
    const renderSize = { width: 49, height: 49 };
    const areaKey = "0,0";

    const expected = (() => {
      const rowStarts = [0, chunkSize];
      const colStarts = [0, chunkSize];
      let minCol = Number.POSITIVE_INFINITY;
      let maxCol = Number.NEGATIVE_INFINITY;
      let minRow = Number.POSITIVE_INFINITY;
      let maxRow = Number.NEGATIVE_INFINITY;

      rowStarts.forEach((startRow) => {
        colStarts.forEach((startCol) => {
          const bounds = getRenderBounds(startRow, startCol, renderSize, chunkSize);
          minCol = Math.min(minCol, bounds.minCol);
          maxCol = Math.max(maxCol, bounds.maxCol);
          minRow = Math.min(minRow, bounds.minRow);
          maxRow = Math.max(maxRow, bounds.maxRow);
        });
      });

      return { minCol, maxCol, minRow, maxRow };
    })();

    expect(getRenderFetchBoundsForArea(areaKey, renderSize, chunkSize, superAreaStrides)).toEqual(expected);
  });

  it("matches unioned canonical chunk bounds for 3x3 super-area windows", () => {
    const chunkSize = 24;
    const superAreaStrides = 3;
    const renderSize = { width: 80, height: 96 };
    const areaKey = "24,-48";

    const expected = (() => {
      let minCol = Number.POSITIVE_INFINITY;
      let maxCol = Number.NEGATIVE_INFINITY;
      let minRow = Number.POSITIVE_INFINITY;
      let maxRow = Number.NEGATIVE_INFINITY;

      for (let rowStride = 0; rowStride < superAreaStrides; rowStride += 1) {
        for (let colStride = 0; colStride < superAreaStrides; colStride += 1) {
          const startRow = 24 + rowStride * chunkSize;
          const startCol = -48 + colStride * chunkSize;
          const bounds = getRenderBounds(startRow, startCol, renderSize, chunkSize);
          minCol = Math.min(minCol, bounds.minCol);
          maxCol = Math.max(maxCol, bounds.maxCol);
          minRow = Math.min(minRow, bounds.minRow);
          maxRow = Math.max(maxRow, bounds.maxRow);
        }
      }

      return { minCol, maxCol, minRow, maxRow };
    })();

    expect(getRenderFetchBoundsForArea(areaKey, renderSize, chunkSize, superAreaStrides)).toEqual(expected);
  });
});

describe("chunk key validation", () => {
  const invalidKeys = ["", "bad-key", "0", "0,", ",0", "1,2,3", "Infinity,0", "NaN,0"];

  it.each(invalidKeys)("rejects malformed keys in getRenderAreaKeyForChunk: %s", (chunkKey) => {
    expect(() => getRenderAreaKeyForChunk(chunkKey, 24, 3)).toThrow(/chunk key/i);
  });

  it.each(invalidKeys)("rejects malformed keys in getRenderFetchBoundsForChunk: %s", (chunkKey) => {
    expect(() => getRenderFetchBoundsForChunk(chunkKey, { width: 48, height: 48 }, 24)).toThrow(/chunk key/i);
  });

  it.each(invalidKeys)("rejects malformed keys in getRenderFetchBoundsForArea: %s", (chunkKey) => {
    expect(() => getRenderFetchBoundsForArea(chunkKey, { width: 48, height: 48 }, 24, 3)).toThrow(/chunk key/i);
  });
});
