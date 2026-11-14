/** A point of the ground: east and south, in world units. */
export interface GroundPoint {
  x: number;
  z: number;
}

/** Where the map's camera looks and from how far. It never turns: north stays up, as on today's map. */
export interface MapCamera {
  target: GroundPoint;
  /** From the eye to the point it looks at. */
  distance: number;
}

/** How steeply the camera looks down, the lens, and how near and far it may stand. */
const CAMERA_PITCH = (52 * Math.PI) / 180;
export const CAMERA_FOV = (40 * Math.PI) / 180;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 300;
const CLOSEST = 4;
const FARTHEST = 60;

export interface Viewport {
  width: number;
  height: number;
}

/** The eye's place: back from the target and above it. */
export function eyeOf(camera: MapCamera): [number, number, number] {
  return [
    camera.target.x,
    Math.sin(CAMERA_PITCH) * camera.distance,
    camera.target.z + Math.cos(CAMERA_PITCH) * camera.distance,
  ];
}

/**
 * The camera's world matrix, column by column (right, up, back, eye), as the renderer takes it. The camera looks north
 * and down, so its right is east.
 */
export function cameraWorldMatrix(camera: MapCamera): Float32Array {
  const [sin, cos] = [Math.sin(CAMERA_PITCH), Math.cos(CAMERA_PITCH)];
  const eye = eyeOf(camera);
  // prettier-ignore
  return new Float32Array([
    1, 0, 0, 0,
    0, cos, -sin, 0,
    0, sin, cos, 0,
    eye[0], eye[1], eye[2], 1,
  ]);
}

/** The point of the ground under a point of the screen, in pixels from the viewport's top left. */
export function groundUnder(camera: MapCamera, viewport: Viewport, screenX: number, screenY: number): GroundPoint {
  const tan = Math.tan(CAMERA_FOV / 2);
  // The ray through the pixel, in the camera's own axes: right, up, and ahead.
  const right = ((screenX / viewport.width) * 2 - 1) * tan * (viewport.width / viewport.height);
  const up = (1 - (screenY / viewport.height) * 2) * tan;
  const [sin, cos] = [Math.sin(CAMERA_PITCH), Math.cos(CAMERA_PITCH)];
  // In the world: the camera's up is (0, cos, -sin), its ahead (0, -sin, -cos).
  const ray = { x: right, y: up * cos - sin, z: -up * sin - cos };
  const eye = eyeOf(camera);
  // A ray at or above the horizon meets the ground far ahead, not behind the eye.
  const reach = ray.y < -1e-4 ? -eye[1] / ray.y : CAMERA_FAR;
  return { x: eye[0] + ray.x * reach, z: eye[2] + ray.z * reach };
}

/**
 * The camera after a finger dragged from one point of the screen to another: the ground that was under the finger
 * stays under it.
 */
export function dragged(
  camera: MapCamera,
  viewport: Viewport,
  from: { x: number; y: number },
  to: { x: number; y: number },
): MapCamera {
  const held = groundUnder(camera, viewport, from.x, from.y);
  const now = groundUnder(camera, viewport, to.x, to.y);
  return { ...camera, target: { x: camera.target.x + held.x - now.x, z: camera.target.z + held.z - now.z } };
}

/**
 * The camera after a zoom by `factor` (above 1 moves away) about a point of the screen: the ground under that point
 * stays under it, so a pinch or a wheel zooms on what the player points at.
 */
export function zoomed(
  camera: MapCamera,
  viewport: Viewport,
  factor: number,
  about: { x: number; y: number },
): MapCamera {
  const held = groundUnder(camera, viewport, about.x, about.y);
  const distance = Math.min(FARTHEST, Math.max(CLOSEST, camera.distance * factor));
  const moved = { ...camera, distance };
  const now = groundUnder(moved, viewport, about.x, about.y);
  return { distance, target: { x: camera.target.x + held.x - now.x, z: camera.target.z + held.z - now.z } };
}
