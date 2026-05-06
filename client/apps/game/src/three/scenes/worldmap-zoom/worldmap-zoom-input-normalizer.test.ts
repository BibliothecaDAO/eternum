import { describe, expect, it } from "vitest";

import { normalizeWorldmapWheelDelta, resolveWorldmapWheelPixelDelta } from "./worldmap-zoom-input-normalizer";

describe("resolveWorldmapWheelPixelDelta", () => {
  it("normalizes wheel deltas across pixel, line, and page modes", () => {
    expect(resolveWorldmapWheelPixelDelta({ delta: 12, deltaMode: 0, viewportHeight: 900 })).toBe(12);
    expect(resolveWorldmapWheelPixelDelta({ delta: 3, deltaMode: 1, viewportHeight: 900 })).toBe(48);
    expect(resolveWorldmapWheelPixelDelta({ delta: 0.5, deltaMode: 2, viewportHeight: 900 })).toBe(450);
  });
});

describe("normalizeWorldmapWheelDelta", () => {
  it("normalizes line and page wheel deltas into the same pixel space", () => {
    expect(normalizeWorldmapWheelDelta({ delta: 3, deltaMode: 1, viewportHeight: 900 }).normalizedDelta).toBe(48);
    expect(normalizeWorldmapWheelDelta({ delta: 0.5, deltaMode: 2, viewportHeight: 900 }).normalizedDelta).toBe(450);
  });

  it("classifies micro-scroll input as trackpad while preserving direction", () => {
    expect(normalizeWorldmapWheelDelta({ delta: -6, deltaMode: 0, viewportHeight: 900 })).toEqual({
      direction: -1,
      inputKind: "trackpad",
      normalizedDelta: -6,
    });
  });

  it("clamps pathological wheel spikes", () => {
    expect(normalizeWorldmapWheelDelta({ delta: 10_000, deltaMode: 0, viewportHeight: 900 }).normalizedDelta).toBe(480);
  });
});
