import { describe, expect, it } from "vitest";

import {
  FAST_TRAVEL_CHUNK_POLICY,
  resolveFastTravelChunkHydrationPlan,
  resolveFastTravelVisibleChunkDecision,
} from "./fast-travel-chunk-loading-runtime";

describe("fast-travel chunk loading runtime", () => {
  it("defines a larger render window than the logical chunk stride", () => {
    expect(FAST_TRAVEL_CHUNK_POLICY).toEqual({
      chunkSize: 12,
      renderSize: { width: 18, height: 18 },
      refreshDebounceMs: 120,
    });
    expect(FAST_TRAVEL_CHUNK_POLICY.renderSize.width).toBeGreaterThan(FAST_TRAVEL_CHUNK_POLICY.chunkSize);
    expect(FAST_TRAVEL_CHUNK_POLICY.renderSize.height).toBeGreaterThan(FAST_TRAVEL_CHUNK_POLICY.chunkSize);
  });

  it("normalizes chunk keys as row,col and expands hydration bounds beyond the stride chunk", () => {
    expect(
      resolveFastTravelChunkHydrationPlan({
        startCol: 24,
        startRow: 12,
      }),
    ).toEqual({
      chunkKey: "12,24",
      startCol: 21,
      startRow: 9,
      width: 18,
      height: 18,
    });
  });

  it("reuses the shared warp-travel chunk decision seam without delay gating", () => {
    expect(
      resolveFastTravelVisibleChunkDecision({
        isSwitchedOff: false,
        focusPoint: {
          x: 12 * Math.sqrt(3),
          z: 12 * 1.5,
        },
        currentChunk: "0,0",
        force: false,
      }),
    ).toEqual({
      action: "switch_chunk",
      chunkChanged: true,
      chunkKey: "12,12",
      startCol: 12,
      startRow: 12,
      shouldPrefetch: true,
    });
  });
});
