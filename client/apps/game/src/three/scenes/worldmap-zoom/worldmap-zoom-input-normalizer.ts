export const WORLDMAP_STEP_WHEEL_DELTA = 120;

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
  inputKind: "trackpad" | "wheel";
}

export function normalizeWorldmapWheelDelta(input: NormalizeWorldmapWheelDeltaInput): NormalizedWorldmapWheelDelta {
  const pixelDelta = resolveWorldmapWheelPixelDelta(input);
  const clampedDelta = clamp(pixelDelta, -(input.maxPixelDelta ?? 480), input.maxPixelDelta ?? 480);
  const direction = Math.sign(clampedDelta) as -1 | 0 | 1;

  return {
    normalizedDelta: clampedDelta,
    direction,
    inputKind: Math.abs(clampedDelta) < 24 ? "trackpad" : "wheel",
  };
}

export function applyContinuousWorldmapZoomDelta(input: ApplyContinuousWorldmapZoomDeltaInput): number {
  const clampedDelta = clamp(input.normalizedDelta, -480, 480);
  const zoomScale = Math.exp(clampedDelta / (input.zoomSensitivity ?? 1200));
  const unclampedDistance = input.currentDistance * zoomScale;

  return clamp(unclampedDistance, input.minDistance, input.maxDistance);
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
