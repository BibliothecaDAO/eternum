import { describe, expect, it } from "vitest";

import { CameraView } from "./camera-view";
import { LOCKED_WORLDMAP_CAMERA_VIEW, resolveLockedWorldmapCameraView } from "./worldmap-camera-band-lock";

describe("worldmap camera band lock", () => {
  it("uses the far band as the only worldmap camera view", () => {
    expect(LOCKED_WORLDMAP_CAMERA_VIEW).toBe(CameraView.Far);
  });

  it("locks every requested worldmap camera view to the far band", () => {
    expect(resolveLockedWorldmapCameraView(CameraView.Close)).toBe(CameraView.Far);
    expect(resolveLockedWorldmapCameraView(CameraView.Medium)).toBe(CameraView.Far);
    expect(resolveLockedWorldmapCameraView(CameraView.Far)).toBe(CameraView.Far);
  });
});
