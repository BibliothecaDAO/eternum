import { describe, expect, it } from "vitest";
import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";

import type { TerrainSurface } from "../terrain/terrain-surface";
import { screenCentrePlacement } from "./screen-centre-placement";

/** Ground at `height`, rising to `rise` at and beyond x = `riseFrom`. */
const ground = (height: number, rise = height, riseFrom = Infinity): TerrainSurface => ({
  sampleSurface: (x) => ({ biome: null, height: x >= riseFrom ? rise : height, normal: [0, 1, 0] }),
});

/** The map's camera, high and pitched down at the ground ahead of it. */
const mapCamera = () => {
  const camera = new PerspectiveCamera(36, 16 / 9, 0.1, 500);
  camera.position.set(0, 20, 14);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
};

const parts = (matrix: Matrix4) => {
  const position = new Vector3();
  const scale = new Vector3();
  matrix.decompose(position, new Quaternion(), scale);
  return { position, scale };
};

// Owner, 28 October 2026: "the chest model base need to be filled it looks very weird atm with the transparent stuff".
// Stood at height 0 under the map's raised ground, its solid stone hex was buried and the map drew through it.
describe("a chest staged at the screen's centre", () => {
  it("stands on the ground where the view's centre meets it, not below it", () => {
    const camera = mapCamera();
    const { position } = parts(screenCentrePlacement(camera, 0.22, ground(0.4))!);
    expect(position.y).toBeCloseTo(0.4);
    // On the view's centre ray at that height: straight ahead of the camera.
    const ray = new Vector3().subVectors(position, camera.position).normalize();
    expect(ray.dot(camera.getWorldDirection(new Vector3()))).toBeCloseTo(1, 4);
  });

  it("rises to the highest ground under its footprint, so no hill buries its base", () => {
    const camera = mapCamera();
    const flat = parts(screenCentrePlacement(camera, 0.22, ground(0.4))!);
    // A rise just inside the chest's hex, short of its centre: the chest stands on top of it.
    const riseFrom = flat.position.x + flat.scale.x * 0.8;
    const { position } = parts(screenCentrePlacement(camera, 0.22, ground(0.4, 1.3, riseFrom))!);
    expect(position.y).toBeCloseTo(1.3);
  });

  it("grows with the camera's distance, filling the same share of the screen at any zoom", () => {
    const near = mapCamera();
    const far = mapCamera();
    far.position.multiplyScalar(2);
    far.updateMatrixWorld();
    const nearScale = parts(screenCentrePlacement(near, 0.22, ground(0))!).scale.x;
    const farScale = parts(screenCentrePlacement(far, 0.22, ground(0))!).scale.x;
    expect(farScale / nearScale).toBeCloseTo(2, 4);
  });

  it("stages nothing when the camera looks at no ground", () => {
    const camera = new PerspectiveCamera(36, 1, 0.1, 500);
    camera.position.set(0, 5, 0);
    camera.lookAt(0, 10, 10);
    camera.updateMatrixWorld();
    expect(screenCentrePlacement(camera, 0.22, ground(0))).toBeNull();
  });
});
