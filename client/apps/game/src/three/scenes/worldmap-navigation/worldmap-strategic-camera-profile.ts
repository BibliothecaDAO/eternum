export interface WorldmapStrategicCameraProfile {
  distance: number;
  tiltDegrees: number;
  tiltRadians: number;
  fovDegrees: number;
}

const WORLDMAP_STRATEGIC_CAMERA_PROFILE: WorldmapStrategicCameraProfile = {
  distance: 56,
  tiltDegrees: 84,
  tiltRadians: (84 * Math.PI) / 180,
  fovDegrees: 16,
};

export function resolveWorldmapStrategicCameraProfile(): WorldmapStrategicCameraProfile {
  return WORLDMAP_STRATEGIC_CAMERA_PROFILE;
}
