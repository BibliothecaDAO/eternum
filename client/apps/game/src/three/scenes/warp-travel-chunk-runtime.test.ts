import { describe, expect, it } from "vitest";

import {
  resolveWarpTravelChunkCoordinates,
  resolveWarpTravelVisibleChunkDecision,
} from "./warp-travel-chunk-runtime";

describe("resolveWarpTravelChunkCoordinates", () => {
  it("derives stride chunk coordinates from world focus position", () => {
    expect(
      resolveWarpTravelChunkCoordinates({
        x: 24 * Math.sqrt(3),
        z: 24 * 1.5,
        chunkSize: 24,
        hexSize: 1,
      }),
    ).toEqual({
      chunkX: 1,
      chunkZ: 1,
      startCol: 24,
      startRow: 24,
      chunkKey: "24,24",
    });
  });
});

describe("resolveWarpTravelVisibleChunkDecision", () => {
  it("returns a no-op when the scene is switched off", () => {
    expect(
      resolveWarpTravelVisibleChunkDecision({
        isSwitchedOff: true,
        focusPoint: { x: 0, z: 0 },
        chunkSize: 24,
        hexSize: 1,
        currentChunk: "0,0",
        force: false,
        reason: "default",
        shouldDelayChunkSwitch: false,
      }),
    ).toEqual({
      action: "noop",
      chunkChanged: false,
      chunkKey: null,
      startCol: null,
      startRow: null,
      shouldPrefetch: false,
    });
  });

  it("returns a delayed no-op when a default navigation chunk switch is still inside the boundary", () => {
    expect(
      resolveWarpTravelVisibleChunkDecision({
        isSwitchedOff: false,
        focusPoint: { x: 24 * Math.sqrt(3), z: 24 * 1.5 },
        chunkSize: 24,
        hexSize: 1,
        currentChunk: "0,0",
        force: false,
        reason: "default",
        shouldDelayChunkSwitch: true,
      }),
    ).toEqual({
      action: "noop",
      chunkChanged: true,
      chunkKey: "24,24",
      startCol: 24,
      startRow: 24,
      shouldPrefetch: false,
    });
  });

  it("bypasses delay gating for shortcut navigation", () => {
    expect(
      resolveWarpTravelVisibleChunkDecision({
        isSwitchedOff: false,
        focusPoint: { x: 24 * Math.sqrt(3), z: 24 * 1.5 },
        chunkSize: 24,
        hexSize: 1,
        currentChunk: "0,0",
        force: false,
        reason: "shortcut",
        shouldDelayChunkSwitch: true,
      }),
    ).toEqual({
      action: "switch_chunk",
      chunkChanged: true,
      chunkKey: "24,24",
      startCol: 24,
      startRow: 24,
      shouldPrefetch: true,
    });
  });

  it("chooses a chunk switch when the active chunk changed", () => {
    expect(
      resolveWarpTravelVisibleChunkDecision({
        isSwitchedOff: false,
        focusPoint: { x: 24 * Math.sqrt(3), z: 24 * 1.5 },
        chunkSize: 24,
        hexSize: 1,
        currentChunk: "0,0",
        force: false,
        reason: "default",
        shouldDelayChunkSwitch: false,
      }),
    ).toEqual({
      action: "switch_chunk",
      chunkChanged: true,
      chunkKey: "24,24",
      startCol: 24,
      startRow: 24,
      shouldPrefetch: true,
    });
  });

  it("chooses a forced refresh when the chunk is stable", () => {
    expect(
      resolveWarpTravelVisibleChunkDecision({
        isSwitchedOff: false,
        focusPoint: { x: 24 * Math.sqrt(3), z: 24 * 1.5 },
        chunkSize: 24,
        hexSize: 1,
        currentChunk: "24,24",
        force: true,
        reason: "default",
        shouldDelayChunkSwitch: false,
      }),
    ).toEqual({
      action: "refresh_current_chunk",
      chunkChanged: false,
      chunkKey: "24,24",
      startCol: 24,
      startRow: 24,
      shouldPrefetch: true,
    });
  });

  it("returns a no-op when the chunk is stable and no refresh was requested", () => {
    expect(
      resolveWarpTravelVisibleChunkDecision({
        isSwitchedOff: false,
        focusPoint: { x: 24 * Math.sqrt(3), z: 24 * 1.5 },
        chunkSize: 24,
        hexSize: 1,
        currentChunk: "24,24",
        force: false,
        reason: "default",
        shouldDelayChunkSwitch: false,
      }),
    ).toEqual({
      action: "noop",
      chunkChanged: false,
      chunkKey: "24,24",
      startCol: 24,
      startRow: 24,
      shouldPrefetch: true,
    });
  });
});
