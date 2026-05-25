import { describe, expect, it } from "vitest";

import {
  WORLDMAP_STEP_WHEEL_DELTA,
  applyContinuousWorldmapZoomDelta,
  normalizeWorldmapWheelDelta,
  resolveWorldmapWheelPixelDelta,
} from "./worldmap-zoom-input-normalizer";

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

describe("applyContinuousWorldmapZoomDelta", () => {
  it("uses a symmetric exponential distance curve for zoom in and zoom out", () => {
    expect(
      applyContinuousWorldmapZoomDelta({
        currentDistance: 20,
        normalizedDelta: -WORLDMAP_STEP_WHEEL_DELTA,
        minDistance: 10,
        maxDistance: 40,
      }),
    ).toBeCloseTo(18.1, 1);

    expect(
      applyContinuousWorldmapZoomDelta({
        currentDistance: 20,
        normalizedDelta: WORLDMAP_STEP_WHEEL_DELTA,
        minDistance: 10,
        maxDistance: 40,
      }),
    ).toBeCloseTo(22.1, 1);
  });

  it("clamps the resolved distance within the worldmap zoom bounds", () => {
    expect(
      applyContinuousWorldmapZoomDelta({
        currentDistance: 10.2,
        normalizedDelta: -WORLDMAP_STEP_WHEEL_DELTA * 4,
        minDistance: 10,
        maxDistance: 40,
      }),
    ).toBe(10);

    expect(
      applyContinuousWorldmapZoomDelta({
        currentDistance: 39.5,
        normalizedDelta: WORLDMAP_STEP_WHEEL_DELTA * 4,
        minDistance: 10,
        maxDistance: 40,
      }),
    ).toBe(40);
  });
});
