import { CameraView } from "./camera-view";

const WORLDMAP_CAMERA_FOV_DEGREES = 38;

interface WorldmapCameraViewProfile {
  angleDegrees: number;
  angleRadians: number;
  distance: number;
}

export function resolveWorldmapCameraFieldOfViewDegrees(): number {
  return WORLDMAP_CAMERA_FOV_DEGREES;
}

export function resolveWorldmapCameraViewProfile(view: CameraView): WorldmapCameraViewProfile {
  return resolveWorldmapCameraViewProfiles()[view];
}

export function resolveWorldmapCameraViewProfiles(): Record<CameraView, WorldmapCameraViewProfile> {
  return {
    [CameraView.Close]: createWorldmapCameraViewProfile(10, 42),
    [CameraView.Medium]: createWorldmapCameraViewProfile(20, 52),
    [CameraView.Far]: createWorldmapCameraViewProfile(40, 58),
  };
}

function createWorldmapCameraViewProfile(distance: number, angleDegrees: number): WorldmapCameraViewProfile {
  return {
    angleDegrees,
    angleRadians: (angleDegrees * Math.PI) / 180,
    distance,
  };
}
