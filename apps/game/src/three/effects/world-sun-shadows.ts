import type { DirectionalLight } from "three";

export function configureWorldSunShadows(light: DirectionalLight, enabled: boolean, mapSize: number): void {
  light.castShadow = enabled;
  light.shadow.mapSize.set(mapSize, mapSize);
  Object.assign(light.shadow.camera, { left: -20, right: 20, top: 13, bottom: -13, near: 8, far: 38 });
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.bias = -0.02;
}
