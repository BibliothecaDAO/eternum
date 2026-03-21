import { CameraView } from "./camera-view";

export interface WorldmapCameraViewProfile {
  angleDegrees: number;
  angleRadians: number;
  distance: number;
}

export function resolveWorldmapCameraViewProfile(view: CameraView): WorldmapCameraViewProfile {
  return resolveWorldmapCameraViewProfiles()[view];
}

export function resolveWorldmapCameraViewProfiles(): Record<CameraView, WorldmapCameraViewProfile> {
  return {
    [CameraView.Close]: createWorldmapCameraViewProfile(10, 30),
    [CameraView.Medium]: createWorldmapCameraViewProfile(20, 50),
    [CameraView.Far]: createWorldmapCameraViewProfile(40, 60),
  };
}

function createWorldmapCameraViewProfile(distance: number, angleDegrees: number): WorldmapCameraViewProfile {
  return {
    angleDegrees,
    angleRadians: (angleDegrees * Math.PI) / 180,
    distance,
  };
}
