import { PerspectiveCamera, Vector3, WebGPUCoordinateSystem } from "three";
import { describe, expect, it } from "vitest";

import { findNearestTerrainHex } from "../terrain/terrain-coordinates";
import { resolveWorldmapCameraGroundBounds } from "./worldmap-camera-ground-bounds";
import { resolveWorldmapCameraPitchRadians } from "./worldmap-camera-view-profile";
import { resolveWorldmapVisualTerrainWindow } from "./worldmap-terrain-presentation-runtime";

function camera(distance: number, aspect: number, col = 0, row = 0): PerspectiveCamera {
  const pitch = resolveWorldmapCameraPitchRadians(distance);
  const camera = new PerspectiveCamera(38, aspect, 0.1, distance * 3.5);
  camera.position.set(col, Math.sin(pitch) * distance, row + Math.cos(pitch) * distance);
  camera.lookAt(col, 0, row);
  return camera;
}

describe("camera-driven terrain coverage", () => {
  it("keeps the widest supported viewport inside the presentation capacity across page boundaries", () => {
    for (let x = -24; x <= 24; x += 6) {
      for (let z = -24; z <= 24; z += 6) {
        const bounds = resolveWorldmapCameraGroundBounds(camera(45, 32 / 9, x, z))!;
        const window = resolveWorldmapVisualTerrainWindow({
          focusPoint: { x, z },
          groundBounds: bounds,
          generation: 1,
          hexSize: 1,
          paddingHexes: 4,
          pageOrigin: { col: -12, row: -12 },
          pageSize: { width: 24, height: 24 },
        });
        expect(window.pageKeys.length, `camera at ${x},${z}`).toBeLessThanOrEqual(16);
      }
    }
  });
  it.each([1, 16 / 9, 21 / 9, 32 / 9])(
    "covers every visible ground sample at aspect %s and each supported zoom",
    (aspect) => {
      for (const distance of [10, 20, 45]) {
        const view = camera(distance, aspect, -17, -41);
        const bounds = resolveWorldmapCameraGroundBounds(view)!;
        const window = resolveWorldmapVisualTerrainWindow({
          focusPoint: { x: -17, z: -41 },
          groundBounds: bounds,
          generation: 1,
          hexSize: 1,
          paddingHexes: 4,
          pageOrigin: { col: -12, row: -12 },
          pageSize: { width: 24, height: 24 },
        });
        expect(window.pageKeys.length).toBeLessThanOrEqual(16);
        expect(window.criticalPageKeys.length).toBeGreaterThan(0);
        for (let x = -100; x <= 100; x += 2) {
          for (let z = -120; z <= 60; z += 2) {
            const ndc = new Vector3(x, 0, z).project(view);
            if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || Math.abs(ndc.z) > 1) continue;
            expect(x).toBeGreaterThanOrEqual(bounds.minX - 0.001);
            expect(x).toBeLessThanOrEqual(bounds.maxX + 0.001);
            expect(z).toBeGreaterThanOrEqual(bounds.minZ - 0.001);
            expect(z).toBeLessThanOrEqual(bounds.maxZ + 0.001);
            const hex = findNearestTerrainHex(x, z);
            const pageCol = Math.floor((hex.col + 12) / 24) * 24 - 12;
            const pageRow = Math.floor((hex.row + 12) / 24) * 24 - 12;
            expect(window.criticalPageKeys).toContain(`${pageRow},${pageCol}`);
          }
        }
      }
    },
  );

  it("changes its footprint on zoom and resize even when the center stays still", () => {
    const narrow = resolveWorldmapCameraGroundBounds(camera(20, 1))!;
    const wide = resolveWorldmapCameraGroundBounds(camera(20, 3))!;
    const far = resolveWorldmapCameraGroundBounds(camera(45, 1))!;
    expect(wide.maxX - wide.minX).toBeGreaterThan((narrow.maxX - narrow.minX) * 2.9);
    expect(far.maxZ - far.minZ).toBeGreaterThan((narrow.maxZ - narrow.minZ) * 1.8);
  });

  it("uses the same visible ground under WebGPU and WebGL clip conventions", () => {
    const view = camera(45, 2);
    const webgl = resolveWorldmapCameraGroundBounds(view);
    view.coordinateSystem = WebGPUCoordinateSystem;
    view.updateProjectionMatrix();
    const webgpu = resolveWorldmapCameraGroundBounds(view)!;
    for (const key of ["minX", "maxX", "minZ", "maxZ"] as const) expect(webgpu[key]).toBeCloseTo(webgl![key]);
  });
});
