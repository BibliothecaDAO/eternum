import { type DirectionalLight, type PerspectiveCamera, Vector3 } from "three";

export function configureWorldSunShadows(light: DirectionalLight, enabled: boolean, mapSize: number): void {
  light.castShadow = enabled;
  light.shadow.mapSize.set(mapSize, mapSize);
  Object.assign(light.shadow.camera, { left: -20, right: 20, top: 13, bottom: -13, near: 8, far: 38 });
  light.shadow.camera.updateProjectionMatrix();
  // Depth bias is normalized across the shadow camera span; -0.02 detached
  // silhouettes by roughly 0.6 world units. A small normal offset prevents acne.
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = 0.025;
}

/** The screen's four corners, as the camera projects them. */
const SCREEN_CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;
/** How far past the screen's edge a caster may stand and still throw its shadow onto the ground in view. */
const CASTER_REACH = 2;
/** How high above the ground the tallest caster reaches, towards the sun. */
const CASTER_HEIGHT = 6;
/** The box grows and shrinks in these steps, so the map is drawn again only when the view's size truly changes. */
const STEP = 0.25;
const snapOut = (value: number, direction: 1 | -1) => (direction > 0 ? Math.ceil : Math.floor)(value / STEP) * STEP;

const corner = new Vector3();
const ray = new Vector3();

/**
 * The sun's shadow map covers the ground the camera shows and no more: the four corners of the screen, laid on the
 * ground, then a margin for what stands just outside. Closer in, the same map covers less ground, so each of its texels
 * is smaller and a shadow keeps the shape of what casts it: fronds, leaves, fences.
 */
export function fitSunShadowToView(light: DirectionalLight, camera: PerspectiveCamera): void {
  const shadowCamera = light.shadow.camera;
  shadowCamera.position.copy(light.position);
  shadowCamera.lookAt(light.target.position);
  shadowCamera.updateMatrixWorld();
  camera.updateMatrixWorld();

  let left = Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  let top = -Infinity;
  let nearest = Infinity;
  let farthest = -Infinity;
  for (const [x, y] of SCREEN_CORNERS) {
    placeOnGround(camera, x, y, corner).applyMatrix4(shadowCamera.matrixWorldInverse);
    left = Math.min(left, corner.x);
    right = Math.max(right, corner.x);
    bottom = Math.min(bottom, corner.y);
    top = Math.max(top, corner.y);
    nearest = Math.min(nearest, -corner.z);
    farthest = Math.max(farthest, -corner.z);
  }

  Object.assign(shadowCamera, {
    left: snapOut(left - CASTER_REACH, -1),
    right: snapOut(right + CASTER_REACH, 1),
    bottom: snapOut(bottom - CASTER_REACH, -1),
    top: snapOut(top + CASTER_REACH, 1),
    near: Math.max(0.5, snapOut(nearest - CASTER_HEIGHT, -1)),
    far: snapOut(farthest + 1, 1),
  });
  shadowCamera.updateProjectionMatrix();
}

/** Where the ray through a point of the screen meets the ground, or the camera's far plane if it never does. */
function placeOnGround(camera: PerspectiveCamera, x: number, y: number, out: Vector3): Vector3 {
  ray.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
  const reach = ray.y < -1e-3 ? Math.min(-camera.position.y / ray.y, camera.far) : camera.far;
  return out.copy(camera.position).addScaledVector(ray, reach);
}
