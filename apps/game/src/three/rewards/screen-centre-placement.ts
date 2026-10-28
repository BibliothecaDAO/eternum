import * as THREE from "three";

import { hexRimOffsets, highestGroundAt, type TerrainSurface } from "../terrain/terrain-surface";

/**
 * Where a chest stands at the screen's centre: where the view's centre meets the ground, raised to the highest ground
 * under its footprint so its solid stone hex is buried nowhere, and scaled so the chest fills `share` of the screen's
 * height at the camera's distance. None when the camera looks at no ground.
 */
export const screenCentrePlacement = (
  camera: THREE.Camera,
  share: number,
  surface: TerrainSurface,
): THREE.Matrix4 | null => {
  const direction = camera.getWorldDirection(new THREE.Vector3());
  if (direction.y >= 0) return null;
  const ground = groundUnderView(camera.position, direction, surface);
  const distance = camera.position.distanceTo(ground);
  const fov = camera instanceof THREE.PerspectiveCamera ? THREE.MathUtils.degToRad(camera.fov) : Math.PI / 4;
  const scale = share * 2 * distance * Math.tan(fov / 2);
  // The chest's hex is about one unit from its centre to a corner (reward-tiles/SOURCE.md), so `scale` here.
  ground.y = highestGroundAt(surface, ground.x, ground.z, [
    [0, 0],
    ...hexRimOffsets(scale / 2),
    ...hexRimOffsets(scale),
  ]);
  return new THREE.Matrix4().compose(ground, new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
};

/** Where a ray from the camera meets the ground: the flat plane first, then the terrain's height there, refined. */
const groundUnderView = (from: THREE.Vector3, direction: THREE.Vector3, surface: TerrainSurface): THREE.Vector3 => {
  const at = (height: number) => from.clone().addScaledVector(direction, (height - from.y) / direction.y);
  let ground = at(0);
  for (let pass = 0; pass < 4; pass++) ground = at(surface.sampleSurface(ground.x, ground.z).height);
  return ground;
};
