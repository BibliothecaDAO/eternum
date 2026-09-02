import { describe, expect, it } from "vitest";

import {
  applyContinuousWorldmapZoomDelta,
  normalizeWorldmapWheelDelta,
  resolveWorldmapWheelPixelDelta,
} from "./worldmap-zoom-input-normalizer";

const WHEEL_NOTCH_DELTA = 120;

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

  it("preserves the direction of micro-scroll input", () => {
    expect(normalizeWorldmapWheelDelta({ delta: -6, deltaMode: 0, viewportHeight: 900 })).toEqual({
      direction: -1,
      normalizedDelta: -6,
    });
  });

  it("clamps pathological wheel spikes", () => {
    expect(normalizeWorldmapWheelDelta({ delta: 10_000, deltaMode: 0, viewportHeight: 900 }).normalizedDelta).toBe(480);
  });
});

describe("applyContinuousWorldmapZoomDelta", () => {
  it("uses a symmetric exponential distance curve for zoom in and zoom out", () => {
    expect(
      applyContinuousWorldmapZoomDelta({
        currentDistance: 20,
        normalizedDelta: -WHEEL_NOTCH_DELTA,
        minDistance: 10,
        maxDistance: 40,
      }),
    ).toBeCloseTo(16.37, 1);

    expect(
      applyContinuousWorldmapZoomDelta({
        currentDistance: 20,
        normalizedDelta: WHEEL_NOTCH_DELTA,
        minDistance: 10,
        maxDistance: 40,
      }),
    ).toBeCloseTo(24.43, 1);
  });

  it("clamps the resolved distance within the worldmap zoom bounds", () => {
    expect(
      applyContinuousWorldmapZoomDelta({
        currentDistance: 10.2,
        normalizedDelta: -WHEEL_NOTCH_DELTA * 4,
        minDistance: 10,
        maxDistance: 40,
      }),
    ).toBe(10);

    expect(
      applyContinuousWorldmapZoomDelta({
        currentDistance: 39.5,
        normalizedDelta: WHEEL_NOTCH_DELTA * 4,
        minDistance: 10,
        maxDistance: 40,
      }),
    ).toBe(40);
  });
});
