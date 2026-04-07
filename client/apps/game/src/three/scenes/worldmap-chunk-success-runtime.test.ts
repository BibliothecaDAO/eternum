import { describe, expect, it } from "vitest";

import {
  recordWorldmapChunkMemoryDelta,
  resolveWorldmapChunkSwitchAnchorState,
} from "./worldmap-chunk-success-runtime";

describe("recordWorldmapChunkMemoryDelta", () => {
  it("returns undefined when either memory snapshot is missing", () => {
    expect(
      recordWorldmapChunkMemoryDelta({ postChunkStats: undefined, preChunkStats: { heapUsedMB: 10 } }),
    ).toBeUndefined();
    expect(
      recordWorldmapChunkMemoryDelta({ postChunkStats: { heapUsedMB: 14 }, preChunkStats: undefined }),
    ).toBeUndefined();
  });

  it("computes the heap delta when both snapshots are available", () => {
    expect(
      recordWorldmapChunkMemoryDelta({
        postChunkStats: { heapUsedMB: 18.5 },
        preChunkStats: { heapUsedMB: 11.25 },
      }),
    ).toBe(7.25);
  });
});

describe("resolveWorldmapChunkSwitchAnchorState", () => {
  it("preserves the previous anchor state when no switch position is provided", () => {
    expect(
      resolveWorldmapChunkSwitchAnchorState({
        nextMovementVector: { x: 4, z: 5 },
        previousAnchorState: {
          hasChunkSwitchAnchor: true,
          movementVector: { x: 1, z: 2 },
          switchPosition: { x: 3, z: 4 },
        },
        switchPosition: undefined,
      }),
    ).toEqual({
      hasChunkSwitchAnchor: true,
      movementVector: { x: 1, z: 2 },
      switchPosition: { x: 3, z: 4 },
    });
  });

  it("updates the anchor state when a committed chunk switch provides a new position", () => {
    expect(
      resolveWorldmapChunkSwitchAnchorState({
        nextMovementVector: { x: 8, z: -3 },
        previousAnchorState: {
          hasChunkSwitchAnchor: false,
          movementVector: null,
          switchPosition: undefined,
        },
        switchPosition: { x: 99, z: 101 },
      }),
    ).toEqual({
      hasChunkSwitchAnchor: true,
      movementVector: { x: 8, z: -3 },
      switchPosition: { x: 99, z: 101 },
    });
  });

  it("falls back to the previous movement vector when the reversal policy does not provide a new one", () => {
    expect(
      resolveWorldmapChunkSwitchAnchorState({
        nextMovementVector: null,
        previousAnchorState: {
          hasChunkSwitchAnchor: true,
          movementVector: { x: 6, z: 7 },
          switchPosition: { x: 40, z: 50 },
        },
        switchPosition: { x: 41, z: 51 },
      }),
    ).toEqual({
      hasChunkSwitchAnchor: true,
      movementVector: { x: 6, z: 7 },
      switchPosition: { x: 41, z: 51 },
    });
  });
});
