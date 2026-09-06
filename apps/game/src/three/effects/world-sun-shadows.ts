import type { DirectionalLight } from "three";

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
