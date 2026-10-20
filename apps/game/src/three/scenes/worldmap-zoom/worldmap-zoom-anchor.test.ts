import { PerspectiveCamera, Vector2, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
} from "../worldmap-camera-view-profile";
import { groundUnderCursor, zoomTowardCursor } from "./worldmap-zoom-anchor";

/** The world map's camera at a distance from its target, placed as the scene places it at every zoom step. */
const placeAt = (camera: PerspectiveCamera, target: Vector3, distance: number) => {
  const pitch = resolveWorldmapCameraPitchRadians(distance);
  camera.position.set(target.x, target.y + Math.sin(pitch) * distance, target.z + Math.cos(pitch) * distance);
};

const view = (distance: number) => {
  const camera = new PerspectiveCamera(resolveWorldmapCameraFieldOfViewDegrees(), 1440 / 900, 0.1, 200);
  const target = new Vector3(12, 0, -7);
  placeAt(camera, target, distance);
  return { camera, target };
};

// The player points at an army in the view's upper right, the home realm at the centre.
const cursor = new Vector2(0.55, 0.35);

describe("the wheel's zoom on the world map", () => {
  it("keeps the ground the cursor points at under the cursor at every step, as far as the view zooms", () => {
    const { camera, target } = view(30);
    const ground = groundUnderCursor(camera, target, cursor)!;

    for (const distance of [26, 20, 14, 10]) {
      zoomTowardCursor(camera, target, cursor, () => placeAt(camera, target, distance));
      expect(groundUnderCursor(camera, target, cursor)!.distanceTo(ground)).toBeLessThan(1e-6);
    }
  });

  it("keeps a pan made while it eases: the drag moves the view as far as it would have without the zoom", () => {
    const steps = [26, 20, 14, 10];
    const zoomed = view(30);
    for (const distance of steps) {
      zoomTowardCursor(zoomed.camera, zoomed.target, cursor, () => placeAt(zoomed.camera, zoomed.target, distance));
    }

    // The same zoom, with the map dragged two units east between its second and third steps.
    const panned = view(30);
    steps.forEach((distance, step) => {
      if (step === 2) {
        panned.camera.position.x += 2;
        panned.target.x += 2;
      }
      zoomTowardCursor(panned.camera, panned.target, cursor, () => placeAt(panned.camera, panned.target, distance));
    });

    expect(panned.target.x - zoomed.target.x).toBeCloseTo(2, 6);
    expect(panned.target.z - zoomed.target.z).toBeCloseTo(0, 6);
  });

  it("zooms about the centre when no wheel turned (the keys, the minimap)", () => {
    const { camera, target } = view(30);
    const centre = target.clone();
    zoomTowardCursor(camera, target, null, () => placeAt(camera, target, 14));
    expect(target).toEqual(centre);
  });
});
