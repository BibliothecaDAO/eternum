import { describe, expect, it } from "vitest";
import { getRenderBounds } from "../utils/chunk-geometry";
import {
  getRenderAreaKeyForChunk,
  getRenderFetchBoundsForArea,
  getRenderFetchBoundsForChunk,
  isHexInsideAnyBounds,
  resolveToriiSubscriptionSwitchDecision,
} from "./worldmap-chunk-bounds";

describe("isHexInsideAnyBounds", () => {
  const retainedBounds = [
    { minCol: -10, maxCol: 10, minRow: -5, maxRow: 5 },
    { minCol: 20, maxCol: 30, minRow: 40, maxRow: 50 },
  ];

  it("keeps boundary positions in any retained render area", () => {
    expect(isHexInsideAnyBounds(-10, 5, retainedBounds)).toBe(true);
    expect(isHexInsideAnyBounds(25, 45, retainedBounds)).toBe(true);
  });

  it("rejects positions outside every retained render area", () => {
    expect(isHexInsideAnyBounds(11, 5, retainedBounds)).toBe(false);
    expect(isHexInsideAnyBounds(25, 39, retainedBounds)).toBe(false);
  });
});

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

describe("resolveToriiSubscriptionSwitchDecision", () => {
  type ChunkBounds = { minCol: number; maxCol: number; minRow: number; maxRow: number };

  const subscriptionBounds = new Map<string, ChunkBounds>([
    ["0,0", { minCol: 0, maxCol: 100, minRow: 0, maxRow: 100 }],
    ["100,0", { minCol: 100, maxCol: 200, minRow: 0, maxRow: 100 }],
  ]);

  const renderAreaBounds = new Map<string, ChunkBounds>([
    ["area-current", { minCol: 20, maxCol: 40, minRow: 20, maxRow: 40 }],
    ["area-prefetch", { minCol: 70, maxCol: 90, minRow: 20, maxRow: 40 }],
    ["area-outside", { minCol: 120, maxCol: 140, minRow: 20, maxRow: 40 }],
  ]);

  const getSubscriptionBoundsForArea = (areaKey: string): ChunkBounds => {
    const bounds = subscriptionBounds.get(areaKey);
    if (!bounds) throw new Error(`Missing subscription bounds for ${areaKey}`);
    return bounds;
  };

  const getRenderAreaBounds = (areaKey: string): ChunkBounds => {
    const bounds = renderAreaBounds.get(areaKey);
    if (!bounds) throw new Error(`Missing render bounds for ${areaKey}`);
    return bounds;
  };

  it("keeps the current live subscription while it covers useful render areas", () => {
    expect(
      resolveToriiSubscriptionSwitchDecision({
        currentSubscriptionAreaKey: "0,0",
        requestedSubscriptionAreaKey: "100,0",
        requiredRenderAreaKeys: ["area-current", "area-prefetch"],
        getSubscriptionBoundsForArea,
        getRenderAreaBounds,
      }),
    ).toEqual({
      action: "keep_current",
      areaKey: "0,0",
      reason: "covered_by_current_subscription",
    });
  });

  it("switches when any useful render area leaves the current live subscription", () => {
    expect(
      resolveToriiSubscriptionSwitchDecision({
        currentSubscriptionAreaKey: "0,0",
        requestedSubscriptionAreaKey: "100,0",
        requiredRenderAreaKeys: ["area-current", "area-outside"],
        getSubscriptionBoundsForArea,
        getRenderAreaBounds,
      }),
    ).toEqual({
      action: "switch",
      areaKey: "100,0",
      reason: "useful_area_outside_current_subscription",
    });
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
