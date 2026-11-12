import { DirectionalLight, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { placeKeyLight } from "./key-light";
import { configureWorldSunShadows, fitSunShadowToView } from "./world-sun-shadows";

/** The map's camera: 45° of view, 60° above the ground, looking at the origin from `distance`. */
function mapCamera(distance: number, aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(45, aspect, 0.1, 100);
  camera.position.set(0, distance * Math.sin(Math.PI / 3), distance * Math.cos(Math.PI / 3));
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return camera;
}

function sunOverOrigin(): DirectionalLight {
  const light = new DirectionalLight();
  configureWorldSunShadows(light, true, 1024);
  placeKeyLight(new Vector3(), light.position, light.target.position);
  return light;
}

/** Where a point of the screen lies on the ground, in the sun's shadow camera. */
function groundInSunView(camera: PerspectiveCamera, light: DirectionalLight, x: number, y: number): Vector3 {
  const direction = new Vector3(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
  const ground = camera.position.clone().addScaledVector(direction, -camera.position.y / direction.y);
  return ground.applyMatrix4(light.shadow.camera.matrixWorldInverse);
}

const width = (light: DirectionalLight) => light.shadow.camera.right - light.shadow.camera.left;

describe("fitSunShadowToView", () => {
  it("covers every corner of the screen laid on the ground", () => {
    for (const [distance, aspect] of [
      [5, 16 / 9],
      [10, 390 / 844],
      [20, 16 / 9],
    ]) {
      const camera = mapCamera(distance, aspect);
      const light = sunOverOrigin();
      fitSunShadowToView(light, camera);
      const box = light.shadow.camera;
      for (const [x, y] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        const corner = groundInSunView(camera, light, x, y);
        expect(corner.x).toBeGreaterThan(box.left);
        expect(corner.x).toBeLessThan(box.right);
        expect(corner.y).toBeGreaterThan(box.bottom);
        expect(corner.y).toBeLessThan(box.top);
        expect(-corner.z).toBeGreaterThan(box.near);
        expect(-corner.z).toBeLessThan(box.far);
      }
    }
  });

  it("covers less ground as the camera comes down, so each shadow texel is smaller", () => {
    const close = sunOverOrigin();
    const open = sunOverOrigin();
    const widest = sunOverOrigin();
    fitSunShadowToView(close, mapCamera(5, 16 / 9));
    fitSunShadowToView(open, mapCamera(10, 16 / 9));
    fitSunShadowToView(widest, mapCamera(20, 16 / 9));

    expect(width(close)).toBeLessThan(width(open) / 1.5);
    expect(width(open)).toBeLessThan(width(widest) / 1.5);
  });

  it("covers a narrower box on a phone held upright than on a desktop", () => {
    const phone = sunOverOrigin();
    const desktop = sunOverOrigin();
    fitSunShadowToView(phone, mapCamera(10, 390 / 844));
    fitSunShadowToView(desktop, mapCamera(10, 16 / 9));

    expect(width(phone)).toBeLessThan(width(desktop));
  });
});
