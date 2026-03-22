import { describe, expect, it } from "vitest";

import { CameraView } from "./camera-view";
import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraViewProfile,
  resolveWorldmapCameraViewProfiles,
} from "./worldmap-camera-view-profile";

describe("resolveWorldmapCameraViewProfiles", () => {
  it("uses a monotonic top-down camera angle curve as zoom bands move farther away", () => {
    const profiles = resolveWorldmapCameraViewProfiles();

    expect(profiles[CameraView.Close].angleRadians).toBeLessThan(profiles[CameraView.Medium].angleRadians);
    expect(profiles[CameraView.Medium].angleRadians).toBeLessThan(profiles[CameraView.Far].angleRadians);
  });

  it("keeps the existing coarse distance bands while making far view the most tactical angle", () => {
    const closeProfile = resolveWorldmapCameraViewProfile(CameraView.Close);
    const mediumProfile = resolveWorldmapCameraViewProfile(CameraView.Medium);
    const farProfile = resolveWorldmapCameraViewProfile(CameraView.Far);

    expect(closeProfile.distance).toBe(10);
    expect(mediumProfile.distance).toBe(20);
    expect(farProfile.distance).toBe(40);
    expect(closeProfile.angleDegrees).toBe(42);
    expect(mediumProfile.angleDegrees).toBe(52);
    expect(farProfile.angleDegrees).toBe(58);
  });

  it("uses a narrower worldmap field of view to reduce perspective skew", () => {
    expect(resolveWorldmapCameraFieldOfViewDegrees()).toBe(38);
  });
});
