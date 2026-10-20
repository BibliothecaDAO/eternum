import type { HexPosition } from "@bibliothecadao/types";
import { Plane, Raycaster, Vector2, Vector3, type Camera } from "three";

import { worldOrigin } from "../world-origin";

/** A point of the ground, in drawn world units: around the floating origin the view carries. */
export type GroundPoint = { x: number; z: number };

/**
 * What the world map's camera sees of the ground: where its screen's four corners meet it (top left, then clockwise)
 * and the point it looks at, around the floating origin they were drawn about.
 */
export interface CameraView {
  origin: HexPosition;
  footprint: readonly GroundPoint[];
  target: GroundPoint;
}

const CORNERS = [new Vector2(-1, 1), new Vector2(1, 1), new Vector2(1, -1), new Vector2(-1, -1)];
const GROUND = new Plane(new Vector3(0, 1, 0), 0);
const ray = new Raycaster();
const hit = new Vector3();

/** Where the camera's screen corners meet the ground; null while a corner looks above the horizon. */
const groundFootprint = (camera: Camera): GroundPoint[] | null => {
  camera.updateMatrixWorld();
  const footprint: GroundPoint[] = [];
  for (const corner of CORNERS) {
    ray.setFromCamera(corner, camera);
    if (!ray.ray.intersectPlane(GROUND, hit)) return null;
    footprint.push({ x: hit.x, z: hit.z });
  }
  return footprint;
};

let latest: CameraView | null = null;
const listeners = new Set<(view: CameraView) => void>();

/**
 * The world map tells what its camera sees each time the camera changes, before that frame draws: whoever follows the
 * camera (the minimap) draws it in the same frame.
 */
export const publishCameraView = (camera: Camera, target: GroundPoint): void => {
  const footprint = groundFootprint(camera);
  if (!footprint) return;
  latest = { origin: worldOrigin(), footprint, target: { x: target.x, z: target.z } };
  for (const listener of listeners) listener(latest);
};

/** What the camera saw last; null before the world map first draws. */
export const readCameraView = (): CameraView | null => latest;

export const subscribeCameraView = (listener: (view: CameraView) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
