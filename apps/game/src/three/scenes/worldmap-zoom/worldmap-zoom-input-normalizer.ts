interface ResolveWorldmapWheelPixelDeltaInput {
  delta: number;
  deltaMode: number;
  viewportHeight: number;
}

interface NormalizeWorldmapWheelDeltaInput extends ResolveWorldmapWheelPixelDeltaInput {
  maxPixelDelta?: number;
}

interface ApplyContinuousWorldmapZoomDeltaInput {
  currentDistance: number;
  normalizedDelta: number;
  minDistance: number;
  maxDistance: number;
  zoomSensitivity?: number;
}

interface NormalizedWorldmapWheelDelta {
  normalizedDelta: number;
  direction: -1 | 0 | 1;
}

/** Wheel pixels per e-fold of camera distance; shared by wheel and pinch so both feel the same. */
const DEFAULT_ZOOM_SENSITIVITY = 600;

export function normalizeWorldmapWheelDelta(input: NormalizeWorldmapWheelDeltaInput): NormalizedWorldmapWheelDelta {
  const pixelDelta = resolveWorldmapWheelPixelDelta(input);
  const clampedDelta = clamp(pixelDelta, -(input.maxPixelDelta ?? 480), input.maxPixelDelta ?? 480);
  const direction = Math.sign(clampedDelta) as -1 | 0 | 1;

  return { normalizedDelta: clampedDelta, direction };
}

/** One wheel notch (120px) scales the distance by ~1.22, so the full range is about ten notches. */
export function applyContinuousWorldmapZoomDelta(input: ApplyContinuousWorldmapZoomDeltaInput): number {
  const clampedDelta = clamp(input.normalizedDelta, -480, 480);
  const zoomScale = Math.exp(clampedDelta / (input.zoomSensitivity ?? DEFAULT_ZOOM_SENSITIVITY));
  const unclampedDistance = input.currentDistance * zoomScale;

  return clamp(unclampedDistance, input.minDistance, input.maxDistance);
}

/**
 * Maps a pinch step (current spread / previous spread) onto wheel pixels so the camera distance
 * scales by the inverse of the finger spread: doubling the spread halves the distance.
 */
export function resolveWorldmapPinchZoomDelta(input: { scale: number }): number {
  if (!Number.isFinite(input.scale) || input.scale <= 0) {
    return 0;
  }

  return DEFAULT_ZOOM_SENSITIVITY * Math.log(1 / input.scale);
}

export function resolveWorldmapWheelPixelDelta(input: ResolveWorldmapWheelPixelDeltaInput): number {
  if (input.deltaMode === 1) {
    return input.delta * 16;
  }

  if (input.deltaMode === 2) {
    return input.delta * input.viewportHeight;
  }

  return input.delta;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
