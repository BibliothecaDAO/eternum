import { describe, expect, it } from "vitest";

import { cameraWorldMatrix, dragged, eyeOf, groundUnder, zoomed, type MapCamera } from "./map-camera";

const viewport = { width: 390, height: 844 };
const camera: MapCamera = { target: { x: 12, z: -7 }, distance: 20 };

describe("the map camera", () => {
  it("looks at its target through the middle of the screen", () => {
    const under = groundUnder(camera, viewport, viewport.width / 2, viewport.height / 2);
    expect(under.x).toBeCloseTo(12, 4);
    expect(under.z).toBeCloseTo(-7, 4);
  });

  it("hands the renderer a matrix whose last column is the eye, south of the target and above it", () => {
    const matrix = cameraWorldMatrix(camera);
    const eye = eyeOf(camera);
    expect(Array.from(matrix.slice(12, 15))).toEqual(eye.map((value) => Math.fround(value)));
    expect(eye[1]).toBeGreaterThan(0);
    expect(eye[2]).toBeGreaterThan(camera.target.z);
  });

  it("keeps the ground under the finger through a drag", () => {
    const from = { x: 100, y: 500 };
    const to = { x: 260, y: 380 };
    const held = groundUnder(camera, viewport, from.x, from.y);
    const after = groundUnder(dragged(camera, viewport, from, to), viewport, to.x, to.y);
    expect(after.x).toBeCloseTo(held.x, 4);
    expect(after.z).toBeCloseTo(held.z, 4);
  });

  it("zooms on the point under the fingers, and no nearer or further than its limits", () => {
    const about = { x: 80, y: 200 };
    const held = groundUnder(camera, viewport, about.x, about.y);
    const nearer = zoomed(camera, viewport, 0.5, about);
    expect(nearer.distance).toBe(10);
    const after = groundUnder(nearer, viewport, about.x, about.y);
    expect(after.x).toBeCloseTo(held.x, 4);
    expect(after.z).toBeCloseTo(held.z, 4);
    expect(zoomed(camera, viewport, 0.01, about).distance).toBe(4);
    expect(zoomed(camera, viewport, 100, about).distance).toBe(60);
  });
});
