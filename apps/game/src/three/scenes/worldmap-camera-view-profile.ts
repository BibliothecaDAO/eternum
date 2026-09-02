import { WORLDMAP_BAND_BOUNDARIES } from "./worldmap-zoom/worldmap-zoom-band-policy";

const WORLDMAP_CAMERA_FOV_DEGREES = 38;

/**
 * Continuous worldmap zoom range; the wheel sets any camera distance inside it.
 * Zoom-out stops at the top of the mid band: the far strategic band stays in
 * the code and tests but is parked until a map-mode key asks for it.
 */
export const WORLDMAP_CAMERA_ZOOM = {
  minDistance: 10,
  maxDistance: WORLDMAP_BAND_BOUNDARIES.mediumFar,
  defaultDistance: 20,
} as const;

/**
 * Camera pitch keyframes by distance: the closest zoom looks across the terrain,
 * the farthest looks down on the world like a map. Linear between keyframes.
 */
const WORLDMAP_CAMERA_PITCH_KEYFRAMES: ReadonlyArray<readonly [distance: number, pitchDegrees: number]> = [
  [10, 42],
  [20, 52],
  [45, 58],
  [80, 66],
];

export function resolveWorldmapCameraFieldOfViewDegrees(): number {
  return WORLDMAP_CAMERA_FOV_DEGREES;
}

export function resolveWorldmapCameraPitchRadians(distance: number): number {
  return (resolveWorldmapCameraPitchDegrees(distance) * Math.PI) / 180;
}

export function resolveWorldmapCameraPitchDegrees(distance: number): number {
  const keyframes = WORLDMAP_CAMERA_PITCH_KEYFRAMES;
  if (distance <= keyframes[0][0]) return keyframes[0][1];
  for (let index = 1; index < keyframes.length; index += 1) {
    const [toDistance, toPitch] = keyframes[index];
    if (distance > toDistance) continue;
    const [fromDistance, fromPitch] = keyframes[index - 1];
    const progress = (distance - fromDistance) / (toDistance - fromDistance);
    return fromPitch + (toPitch - fromPitch) * progress;
  }
  return keyframes[keyframes.length - 1][1];
}
