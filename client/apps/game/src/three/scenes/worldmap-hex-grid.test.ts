import { describe, expect, it } from "vitest";

import {
  buildHexGridRowMetadata,
  resolveHexGridProcessingPlan,
  resolveHexGridRetainedBounds,
  resolveHexGridStripUpdatePlan,
} from "./worldmap-hex-grid";

describe("buildHexGridRowMetadata", () => {
  it("matches the legacy row geometry calculation for even-sized chunks", () => {
    const rows = 4;
    const halfRows = rows / 2;
    const halfCols = 3;
    const chunkCenterRow = 12;
    const chunkCenterCol = 20;
    const vertDist = 1.5;
    const horizDist = 2.5;

    const metadata = buildHexGridRowMetadata({
      rows,
      halfRows,
      halfCols,
      chunkCenterRow,
      chunkCenterCol,
      vertDist,
      horizDist,
    });

    expect(metadata).toEqual([
      {
        globalRow: 10,
        baseZ: 15,
        rowOffsetValue: 0,
        baseXAtColZero: 42.5,
      },
      {
        globalRow: 11,
        baseZ: 16.5,
        rowOffsetValue: 1.25,
        baseXAtColZero: 41.25,
      },
      {
        globalRow: 12,
        baseZ: 18,
        rowOffsetValue: 0,
        baseXAtColZero: 42.5,
      },
      {
        globalRow: 13,
        baseZ: 19.5,
        rowOffsetValue: 1.25,
        baseXAtColZero: 41.25,
      },
    ]);
  });

  it("preserves the negative-row parity offset behavior", () => {
    const metadata = buildHexGridRowMetadata({
      rows: 3,
      halfRows: 1,
      halfCols: 2,
      chunkCenterRow: -1,
      chunkCenterCol: 5,
      vertDist: 3,
      horizDist: 4,
    });

    expect(metadata).toEqual([
      {
        globalRow: -2,
        baseZ: -6,
        rowOffsetValue: 0,
        baseXAtColZero: 12,
      },
      {
        globalRow: -1,
        baseZ: -3,
        rowOffsetValue: 2,
        baseXAtColZero: 10,
      },
      {
        globalRow: 0,
        baseZ: 0,
        rowOffsetValue: 0,
        baseXAtColZero: 12,
      },
    ]);
  });

  it("keeps the base processing budget when not transitioning", () => {
    expect(
      resolveHexGridProcessingPlan({
        totalHexes: 2304,
        baseFrameBudgetMs: 6.5,
        baseMinBatch: 120,
        baseMaxBatch: 900,
        isChunkTransitioning: false,
        isChunkRefreshRunning: false,
      }),
    ).toEqual({
      frameBudgetMs: 6.5,
      minBatch: 120,
      maxBatch: 900,
    });
  });

  it("uses a more aggressive budget during chunk transitions and refreshes", () => {
    expect(
      resolveHexGridProcessingPlan({
        totalHexes: 2304,
        baseFrameBudgetMs: 6.5,
        baseMinBatch: 120,
        baseMaxBatch: 900,
        isChunkTransitioning: true,
        isChunkRefreshRunning: false,
      }),
    ).toEqual({
      frameBudgetMs: 10,
      minBatch: 240,
      maxBatch: 1575,
    });
  });

  it("caps the aggressive budget by the available hex count", () => {
    expect(
      resolveHexGridProcessingPlan({
        totalHexes: 150,
        baseFrameBudgetMs: 6.5,
        baseMinBatch: 120,
        baseMaxBatch: 900,
        isChunkTransitioning: false,
        isChunkRefreshRunning: true,
      }),
    ).toEqual({
      frameBudgetMs: 10,
      minBatch: 150,
      maxBatch: 150,
    });
  });
});

describe("resolveHexGridRetainedBounds", () => {
  it("returns the overlapping render window intersection", () => {
    expect(
      resolveHexGridRetainedBounds(
        { minCol: -24, maxCol: 23, minRow: -24, maxRow: 23 },
        { minCol: 0, maxCol: 47, minRow: -24, maxRow: 23 },
      ),
    ).toEqual({
      minCol: 0,
      maxCol: 23,
      minRow: -24,
      maxRow: 23,
    });
  });

  it("returns null when render windows do not overlap", () => {
    expect(
      resolveHexGridRetainedBounds(
        { minCol: -24, maxCol: 23, minRow: -24, maxRow: 23 },
        { minCol: 48, maxCol: 95, minRow: -24, maxRow: 23 },
      ),
    ).toBeNull();
  });
});

describe("resolveHexGridStripUpdatePlan", () => {
  const renderSize = { width: 48, height: 48 };
  const chunkSize = 24;

  it("uses a column strip when moving exactly one chunk east", () => {
    expect(
      resolveHexGridStripUpdatePlan({
        previousStartRow: 0,
        previousStartCol: 0,
        nextStartRow: 0,
        nextStartCol: 24,
        renderSize,
        chunkSize,
      }),
    ).toEqual({
      mode: "strip",
      axis: "col",
      direction: 1,
      previousBounds: { minCol: -12, maxCol: 35, minRow: -12, maxRow: 35 },
      nextBounds: { minCol: 12, maxCol: 59, minRow: -12, maxRow: 35 },
      retainedBounds: { minCol: 12, maxCol: 35, minRow: -12, maxRow: 35 },
      incomingBounds: { minCol: 36, maxCol: 59, minRow: -12, maxRow: 35 },
    });
  });

  it("uses a row strip when moving exactly one chunk north", () => {
    expect(
      resolveHexGridStripUpdatePlan({
        previousStartRow: 0,
        previousStartCol: 0,
        nextStartRow: -24,
        nextStartCol: 0,
        renderSize,
        chunkSize,
      }),
    ).toEqual({
      mode: "strip",
      axis: "row",
      direction: -1,
      previousBounds: { minCol: -12, maxCol: 35, minRow: -12, maxRow: 35 },
      nextBounds: { minCol: -12, maxCol: 35, minRow: -36, maxRow: 11 },
      retainedBounds: { minCol: -12, maxCol: 35, minRow: -12, maxRow: 11 },
      incomingBounds: { minCol: -12, maxCol: 35, minRow: -36, maxRow: -13 },
    });
  });

  it("falls back to full rebuild for diagonal chunk moves", () => {
    expect(
      resolveHexGridStripUpdatePlan({
        previousStartRow: 0,
        previousStartCol: 0,
        nextStartRow: 24,
        nextStartCol: 24,
        renderSize,
        chunkSize,
      }),
    ).toEqual({
      mode: "full",
      previousBounds: { minCol: -12, maxCol: 35, minRow: -12, maxRow: 35 },
      nextBounds: { minCol: 12, maxCol: 59, minRow: 12, maxRow: 59 },
      retainedBounds: null,
      incomingBounds: null,
    });
  });

  it("falls back to full rebuild for multi-chunk jumps", () => {
    expect(
      resolveHexGridStripUpdatePlan({
        previousStartRow: 0,
        previousStartCol: 0,
        nextStartRow: 0,
        nextStartCol: 48,
        renderSize,
        chunkSize,
      }),
    ).toEqual({
      mode: "full",
      previousBounds: { minCol: -12, maxCol: 35, minRow: -12, maxRow: 35 },
      nextBounds: { minCol: 36, maxCol: 83, minRow: -12, maxRow: 35 },
      retainedBounds: null,
      incomingBounds: null,
    });
  });
});
