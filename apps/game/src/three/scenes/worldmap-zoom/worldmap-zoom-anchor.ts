import { type Camera, Plane, Raycaster, type Vector2, Vector3 } from "three";

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
 * One step of the wheel's zoom toward the cursor: the ground under the cursor is read as the camera stands now, the
 * camera is placed at its new distance, and the camera and its target move together so that ground stays under the
 * cursor. Read fresh at every step, it corrects only what the step's own change of distance moved, so a pan, a flight
 * or any other move of the target between steps keeps its translation.
 */
export function zoomTowardCursor(
  camera: Camera,
  target: Vector3,
  cursor: Vector2 | null,
  placeAtNewDistance: () => void,
): void {
  const ground = cursor && groundUnderCursor(camera, target, cursor);
  placeAtNewDistance();
  if (!cursor || !ground) return;
  const now = groundUnderCursor(camera, target, cursor);
  if (!now) return;
  const shiftX = ground.x - now.x;
  const shiftZ = ground.z - now.z;
  camera.position.x += shiftX;
  camera.position.z += shiftZ;
  target.x += shiftX;
  target.z += shiftZ;
  camera.updateMatrixWorld();
}
