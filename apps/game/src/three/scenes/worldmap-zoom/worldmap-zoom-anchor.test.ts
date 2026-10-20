import { PerspectiveCamera, Vector2, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
} from "../worldmap-camera-view-profile";
import { groundUnderCursor, holdGroundUnderCursor } from "./worldmap-zoom-anchor";

/** The world map's camera at a distance from its target, placed as the scene places it at every zoom step. */
const placeAt = (camera: PerspectiveCamera, target: Vector3, distance: number) => {
  const pitch = resolveWorldmapCameraPitchRadians(distance);
  camera.position.set(target.x, target.y + Math.sin(pitch) * distance, target.z + Math.cos(pitch) * distance);
};

describe("the wheel's zoom on the world map", () => {
  it("keeps the ground the cursor points at under the cursor at every step, as far as the view zooms", () => {
    const camera = new PerspectiveCamera(resolveWorldmapCameraFieldOfViewDegrees(), 1440 / 900, 0.1, 200);
    const target = new Vector3(12, 0, -7);
    // The player points at an army in the view's upper right, the home realm at the centre.
    const cursor = new Vector2(0.55, 0.35);
    placeAt(camera, target, 30);
    const ground = groundUnderCursor(camera, target, cursor)!;
    const anchor = { cursor, ground: ground.clone() };

    for (const distance of [26, 20, 14, 10]) {
      placeAt(camera, target, distance);
      const unheld = groundUnderCursor(camera, target, cursor)!;
      holdGroundUnderCursor(camera, target, anchor);
      const held = groundUnderCursor(camera, target, cursor)!;

      // Zooming about the centre alone slides the pointed ground away by tiles; held, it stays put.
      expect(unheld.distanceTo(ground)).toBeGreaterThan(1);
      expect(held.distanceTo(ground)).toBeLessThan(1e-6);
    }
  });
});
