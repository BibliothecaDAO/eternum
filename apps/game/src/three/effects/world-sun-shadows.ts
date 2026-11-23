import { type DirectionalLight, type PerspectiveCamera, Vector3 } from "three";

export function configureWorldSunShadows(light: DirectionalLight, enabled: boolean, mapSize: number): void {
  light.castShadow = enabled;
  light.shadow.mapSize.set(mapSize, mapSize);
  Object.assign(light.shadow.camera, { left: -20, right: 20, top: 13, bottom: -13, near: 8, far: 38 });
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = 0.025;
}

const SCREEN_CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;
const CASTER_REACH = 2;
const CASTER_HEIGHT = 6;
const STEP = 1;
const snapOut = (value: number, direction: 1 | -1) => (direction > 0 ? Math.ceil : Math.floor)(value / STEP) * STEP;

const corner = new Vector3();
const ray = new Vector3();

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

function placeOnGround(camera: PerspectiveCamera, x: number, y: number, out: Vector3): Vector3 {
  ray.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
  const reach = ray.y < -1e-3 ? Math.min(-camera.position.y / ray.y, camera.far) : camera.far;
  return out.copy(camera.position).addScaledVector(ray, reach);
}
