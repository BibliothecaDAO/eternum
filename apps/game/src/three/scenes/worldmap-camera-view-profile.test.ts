import { describe, expect, it } from "vitest";

import {
  WORLDMAP_CAMERA_ZOOM,
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchDegrees,
} from "./worldmap-camera-view-profile";

describe("worldmap camera profile", () => {
  it("tilts the camera monotonically toward top-down as the zoom distance grows", () => {
    const distances = [10, 15, 20, 30, 45, 60, 80];
    const pitches = distances.map(resolveWorldmapCameraPitchDegrees);
    pitches.slice(1).forEach((pitch, index) => expect(pitch).toBeGreaterThan(pitches[index]));
  });

  it("keeps the former close, medium and far looks at their distances", () => {
    expect(resolveWorldmapCameraPitchDegrees(10)).toBe(42);
    expect(resolveWorldmapCameraPitchDegrees(20)).toBe(52);
    expect(resolveWorldmapCameraPitchDegrees(45)).toBe(58);
  });

  it("clamps the pitch at both ends of the zoom range", () => {
    expect(resolveWorldmapCameraPitchDegrees(WORLDMAP_CAMERA_ZOOM.minDistance - 5)).toBe(42);
    expect(resolveWorldmapCameraPitchDegrees(WORLDMAP_CAMERA_ZOOM.maxDistance + 50)).toBe(66);
  });

  it("uses a narrower worldmap field of view to reduce perspective skew", () => {
    expect(resolveWorldmapCameraFieldOfViewDegrees()).toBe(38);
  });
});
