import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { getWorldPositionForHex } from "../utils/utils";
import { OwnershipRingLayer } from "./ownership-ring-layer";

const ringObjects = (scene: THREE.Scene) =>
  scene.children.filter((child): child is THREE.Mesh | THREE.LineSegments => child.renderOrder >= 46);

describe("OwnershipRingLayer", () => {
  it("draws a ring on every held hex, set on the ground under it, in one draw per ring layer", () => {
    const scene = new THREE.Scene();
    const ground = (x: number, z: number) => 0.1 * x + 0.05 * z;
    const layer = new OwnershipRingLayer(scene, {
      sampleSurface: (x, z) => ({ biome: null, height: ground(x, z), normal: [0, 1, 0] }),
    });
    const held = [
      { col: 3, row: 4 },
      { col: -7, row: 2 },
    ];

    layer.show(held);

    const objects = ringObjects(scene);
    expect(objects).toHaveLength(3);
    const centres = held.map((hex) => getWorldPositionForHex(hex));
    for (const object of objects) {
      expect(object.visible).toBe(true);
      const positions = object.geometry.getAttribute("position");
      const perRing = positions.count / held.length;
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const centre = centres[Math.floor(vertex / perRing)];
        expect(Math.hypot(positions.getX(vertex) - centre.x, positions.getZ(vertex) - centre.z)).toBeLessThan(1);
        expect(positions.getY(vertex)).toBeGreaterThan(ground(positions.getX(vertex), positions.getZ(vertex)));
        expect(positions.getY(vertex)).toBeLessThan(ground(positions.getX(vertex), positions.getZ(vertex)) + 0.05);
      }
    }
    layer.dispose();
  });

  it("clears every ring when nothing is held", () => {
    const scene = new THREE.Scene();
    const layer = new OwnershipRingLayer(scene, {
      sampleSurface: () => ({ biome: null, height: 0, normal: [0, 1, 0] }),
    });

    layer.show([{ col: 1, row: 1 }]);
    layer.show([]);

    for (const object of ringObjects(scene)) {
      expect(object.visible).toBe(false);
      expect(object.geometry.getAttribute("position").count).toBe(0);
    }
    layer.dispose();
    expect(ringObjects(scene)).toHaveLength(0);
  });

  it("re-grounds the rings when the terrain under them lands", () => {
    const scene = new THREE.Scene();
    let height = 0;
    const layer = new OwnershipRingLayer(scene, {
      sampleSurface: () => ({ biome: null, height, normal: [0, 1, 0] }),
    });
    layer.show([{ col: 1, row: 1 }]);

    height = 2;
    layer.refreshTerrainPlacement();

    for (const object of ringObjects(scene))
      expect(object.geometry.getAttribute("position").getY(0)).toBeGreaterThan(2);
    layer.dispose();
  });
});
