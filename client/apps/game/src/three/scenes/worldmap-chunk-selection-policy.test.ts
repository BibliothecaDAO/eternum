import { describe, expect, it } from "vitest";

import {
  resolveChunkKeyFromHex,
  resolveWorldmapChunkFromWorldPosition,
} from "./worldmap-chunk-selection-policy";

const HORIZ_DIST = Math.sqrt(3);
const VERT_DIST = 1.5;

/** Helper: compute the world position of a hex center (mirrors getWorldPositionForHex with HEX_SIZE=1). */
function hexToWorld(col: number, row: number): { x: number; z: number } {
  const rowOffset = ((row % 2) * Math.sign(row) * HORIZ_DIST) / 2;
  return {
    x: col * HORIZ_DIST - rowOffset,
    z: row * VERT_DIST,
  };
}

describe("resolveWorldmapChunkFromWorldPosition", () => {
  it("derives authority chunk from parity-aware focus hex, not raw world floor coordinates", () => {
    // Place the world position exactly at the center of hex (col=5, row=3)
    const { x, z } = hexToWorld(5, 3);
    const result = resolveWorldmapChunkFromWorldPosition({ worldX: x, worldZ: z, chunkSize: 24 });

    expect(result.focusCol).toBe(5);
    expect(result.focusRow).toBe(3);
    // chunk should snap to stride boundaries
    expect(result.startCol).toBe(0);
    expect(result.startRow).toBe(0);
    expect(result.chunkKey).toBe("0,0");
  });

  it("returns the same chunk key for equivalent odd-row and even-row focus positions", () => {
    // Both (col=10, row=2) and (col=10, row=3) are within the same chunk for chunkSize=24
    const evenRowWorld = hexToWorld(10, 2);
    const oddRowWorld = hexToWorld(10, 3);

    const evenResult = resolveWorldmapChunkFromWorldPosition({
      worldX: evenRowWorld.x,
      worldZ: evenRowWorld.z,
      chunkSize: 24,
    });
    const oddResult = resolveWorldmapChunkFromWorldPosition({
      worldX: oddRowWorld.x,
      worldZ: oddRowWorld.z,
      chunkSize: 24,
    });

    expect(evenResult.chunkKey).toBe(oddResult.chunkKey);
    expect(evenResult.startCol).toBe(oddResult.startCol);
    expect(evenResult.startRow).toBe(oddResult.startRow);
  });

  it("handles negative or offset world positions without desynchronizing hex and chunk ownership", () => {
    // A hex at col=-5, row=-3
    const { x, z } = hexToWorld(-5, -3);
    const result = resolveWorldmapChunkFromWorldPosition({ worldX: x, worldZ: z, chunkSize: 24 });

    expect(result.focusCol).toBe(-5);
    expect(result.focusRow).toBe(-3);
    // -5 / 24 floors to -1, so startCol = -1 * 24 = -24
    expect(result.startCol).toBe(-24);
    expect(result.startRow).toBe(-24);
    expect(result.chunkKey).toBe("-24,-24");
  });

  it("resolveChunkKeyFromHex snaps to chunk stride boundaries", () => {
    // col=25, row=50 with chunkSize=24 -> startCol = 24, startRow = 48
    expect(resolveChunkKeyFromHex(25, 50, 24)).toEqual({
      startCol: 24,
      startRow: 48,
      chunkKey: "48,24",
    });

    // col=0, row=0 -> startCol=0, startRow=0
    expect(resolveChunkKeyFromHex(0, 0, 24)).toEqual({
      startCol: 0,
      startRow: 0,
      chunkKey: "0,0",
    });

    // Negative: col=-1, row=-1 -> startCol=-24, startRow=-24
    expect(resolveChunkKeyFromHex(-1, -1, 24)).toEqual({
      startCol: -24,
      startRow: -24,
      chunkKey: "-24,-24",
    });
  });
});
