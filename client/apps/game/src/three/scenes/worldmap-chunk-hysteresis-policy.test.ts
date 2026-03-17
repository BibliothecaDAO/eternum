import { describe, expect, it } from "vitest";

import { resolveWorldmapChunkHysteresis } from "./worldmap-chunk-hysteresis-policy";

describe("resolveWorldmapChunkHysteresis", () => {
  const chunkSize = 24;
  const renderSize = { width: 60, height: 60 };

  it("keeps the current chunk while focus remains inside the hold band", () => {
    // Focus hex is at the chunk center (row=12, col=12) which is well inside the hold band
    const result = resolveWorldmapChunkHysteresis({
      focusCol: 12,
      focusRow: 12,
      currentChunkStartRow: 0,
      currentChunkStartCol: 0,
      chunkSize,
      renderSize,
      holdBandFraction: 0.25,
    });

    expect(result.shouldStayInCurrentChunk).toBe(true);
    expect(result.shouldSwitchToTargetChunk).toBe(false);
    expect(result.targetChunkKey).toBeNull();
  });

  it("switches once focus exits the hold band into the next chunk", () => {
    // Focus hex far outside the hold band of the current chunk
    const result = resolveWorldmapChunkHysteresis({
      focusCol: 50,
      focusRow: 50,
      currentChunkStartRow: 0,
      currentChunkStartCol: 0,
      chunkSize,
      renderSize,
      holdBandFraction: 0.25,
    });

    expect(result.shouldStayInCurrentChunk).toBe(false);
    expect(result.shouldSwitchToTargetChunk).toBe(true);
    expect(result.targetChunkKey).not.toBeNull();
  });

  it("keeps the current chunk even when focus enters the adjacent authority chunk but remains inside the hold band", () => {
    const result = resolveWorldmapChunkHysteresis({
      focusCol: 25,
      focusRow: 12,
      currentChunkStartRow: 0,
      currentChunkStartCol: 0,
      chunkSize,
      renderSize,
      holdBandFraction: 0.25,
    });

    expect(result.shouldStayInCurrentChunk).toBe(true);
    expect(result.shouldSwitchToTargetChunk).toBe(false);
    expect(result.targetChunkKey).toBeNull();
  });

  it("does not flap when focus oscillates near the switch boundary", () => {
    // Get the hold band boundary: render bounds center is at (12,12) for chunk (0,0) with chunkSize=24
    // Render bounds half-width = 60/2 = 30, so minCol = 12-30 = -18, maxCol = 12+29 = 41
    // Hold band inset = 0.25 * 60 = 15, so hold band: col in [-18+15, 41-15] = [-3, 26]
    // Place focus just inside the hold band
    const justInside = resolveWorldmapChunkHysteresis({
      focusCol: 26,
      focusRow: 12,
      currentChunkStartRow: 0,
      currentChunkStartCol: 0,
      chunkSize,
      renderSize,
      holdBandFraction: 0.25,
    });

    // Place focus just outside the hold band
    const justOutside = resolveWorldmapChunkHysteresis({
      focusCol: 27,
      focusRow: 12,
      currentChunkStartRow: 0,
      currentChunkStartCol: 0,
      chunkSize,
      renderSize,
      holdBandFraction: 0.25,
    });

    expect(justInside.shouldStayInCurrentChunk).toBe(true);
    expect(justOutside.shouldSwitchToTargetChunk).toBe(true);
  });
});
