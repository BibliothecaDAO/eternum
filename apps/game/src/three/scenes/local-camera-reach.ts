import { LOCAL_CAMERA_ZOOM } from "@/three/constants/rendering";
import { HEX_HORIZONTAL_SPACING } from "@/three/utils/hex-lattice";

/** Room beside the outermost plots, so they stand inside the screen's edge rather than on it. */
const EDGE_ROOM = 1.1;

/**
 * How far the realm view's camera may pull back: far enough that every plot the castle reaches fits across the screen
 * (owner, 26 October 2026: "I cant zoom out enough at kingdom level to see all tiles, so it'll be even worse at
 * empire"), and never nearer than the view's fixed limit. Width is what runs out first on a phone held upright, so the
 * reach is fitted to the horizontal field of view the screen's shape leaves.
 */
export const localCameraMaxDistance = ({
  plotRadius,
  aspect,
  fovDegrees,
}: {
  /** The castle's reach in rings of plots around the castle (buildableRadius). */
  plotRadius: number;
  /** The screen's width over its height. */
  aspect: number;
  /** The camera's vertical field of view. */
  fovDegrees: number;
}): number => {
  const halfWidth = (plotRadius + 0.5) * HEX_HORIZONTAL_SPACING;
  const halfHorizontalFov = Math.atan(Math.tan((fovDegrees * Math.PI) / 360) * aspect);
  return Math.max(LOCAL_CAMERA_ZOOM.maxDistance, (halfWidth / Math.tan(halfHorizontalFov)) * EDGE_ROOM);
};
