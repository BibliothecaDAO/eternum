import { describe, expect, it } from "vitest";

import { buildHexGridRowMetadata, resolveHexGridProcessingPlan } from "./worldmap-hex-grid";

describe("buildHexGridRowMetadata", () => {
  it("matches the legacy row geometry calculation for even-sized chunks", () => {
    const rows = 4;
    const halfRows = rows / 2;
    const chunkCenterRow = 12;
    const vertDist = 1.5;
    const horizDist = 2.5;

    const metadata = buildHexGridRowMetadata({
      rows,
      halfRows,
      chunkCenterRow,
      vertDist,
      horizDist,
    });

    expect(metadata).toEqual([
      {
        globalRow: 10,
        baseZ: 15,
        rowOffsetValue: 0,
      },
      {
        globalRow: 11,
        baseZ: 16.5,
        rowOffsetValue: 1.25,
      },
      {
        globalRow: 12,
        baseZ: 18,
        rowOffsetValue: 0,
      },
      {
        globalRow: 13,
        baseZ: 19.5,
        rowOffsetValue: 1.25,
      },
    ]);
  });

  it("preserves the negative-row parity offset behavior", () => {
    const metadata = buildHexGridRowMetadata({
      rows: 3,
      halfRows: 1,
      chunkCenterRow: -1,
      vertDist: 3,
      horizDist: 4,
    });

    expect(metadata).toEqual([
      {
        globalRow: -2,
        baseZ: -6,
        rowOffsetValue: 0,
      },
      {
        globalRow: -1,
        baseZ: -3,
        rowOffsetValue: 2,
      },
      {
        globalRow: 0,
        baseZ: 0,
        rowOffsetValue: 0,
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
