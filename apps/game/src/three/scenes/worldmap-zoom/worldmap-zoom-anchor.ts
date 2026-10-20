import { type Camera, Plane, Raycaster, Vector2, Vector3 } from "three";

/** The point a wheel zoom goes toward: the cursor on screen and the ground it pointed at when the wheel turned. */
export interface WorldmapZoomAnchor {
  cursor: Vector2;
  ground: Vector3;
}

const raycaster = new Raycaster();
const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
const hit = new Vector3();

/** The ground under a screen point (normalized device coordinates), on the plane level with the camera's target. */
export function groundUnderCursor(camera: Camera, target: Vector3, cursor: Vector2): Vector3 | null {
  camera.lookAt(target);
  camera.updateMatrixWorld();
  raycaster.setFromCamera(cursor, camera);
  groundPlane.constant = -target.y;
  return raycaster.ray.intersectPlane(groundPlane, hit)?.clone() ?? null;
}

/**
 * Moves the camera and its target together so the anchor's ground stands under the cursor again: called after each
 * change of distance, it makes the zoom go toward what the player points at instead of the screen's centre.
 */
export function holdGroundUnderCursor(camera: Camera, target: Vector3, anchor: WorldmapZoomAnchor): void {
  const now = groundUnderCursor(camera, target, anchor.cursor);
  if (!now) return;
  const shiftX = anchor.ground.x - now.x;
  const shiftZ = anchor.ground.z - now.z;
  camera.position.x += shiftX;
  camera.position.z += shiftZ;
  target.x += shiftX;
  target.z += shiftZ;
  camera.updateMatrixWorld();
}
