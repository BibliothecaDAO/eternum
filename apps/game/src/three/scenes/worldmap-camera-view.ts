import type { HexPosition } from "@bibliothecadao/types";

import { worldOrigin } from "../world-origin";

/** A point of the ground, in drawn world units: around the floating origin the view carries. */
export type GroundPoint = { x: number; z: number };

/**
 * Where the world map's camera looks: the point on the ground, around the floating origin it was drawn about, and how
 * far the camera stands from it (its zoom).
 */
export interface CameraView {
  origin: HexPosition;
  target: GroundPoint;
  distance: number;
}

let latest: CameraView | null = null;
const listeners = new Set<(view: CameraView) => void>();

/**
 * The world map tells where its camera looks, and from how far, each time the camera changes, before that frame draws: whoever follows the
 * camera (the minimap) draws it in the same frame.
 */
export const publishCameraView = (target: GroundPoint, distance: number): void => {
  latest = { origin: worldOrigin(), target: { x: target.x, z: target.z }, distance };
  for (const listener of listeners) listener(latest);
};

/** The world map is gone: no camera to follow until the next one draws, so a new game never shows the last one's place. */
export const forgetCameraView = (): void => {
  latest = null;
};

/** Where the camera looked last; null before the world map first draws. */
export const readCameraView = (): CameraView | null => latest;

export const subscribeCameraView = (listener: (view: CameraView) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
