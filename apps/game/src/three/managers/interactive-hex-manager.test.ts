// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { TerrainSurface } from "@/three/terrain/terrain-surface";
import { InteractiveHexManager } from "./interactive-hex-manager";

// Flat ground with one rise away from the hex's centre, under its edge.
const groundWithRisingEdge = (rise: number): TerrainSurface => ({
  sampleSurface: (x, z) => ({ biome: null, height: Math.hypot(x, z) > 0.5 ? rise : 0, normal: [0, 1, 0] as const }),
});
const AT_ORIGIN = {
  positionForHex: () => new THREE.Vector3(),
  positionForHexInto: (_col: number, _row: number, out: THREE.Vector3) => out.set(0, 0, 0),
  hexForPosition: () => ({ col: 0, row: 0 }),
};

const bandHeight = (manager: InteractiveHexManager, scene: THREE.Scene): number => {
  manager.addHex({ col: 0, row: 0 });
  manager.renderAllHexes();
  const mesh = scene.children.find((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)!;
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(0, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix).y;
};

describe("a buildable hex's band", () => {
  it("lies clear of the highest ground under its edge, so relief never buries part of the line", () => {
    const scene = new THREE.Scene();
    const manager = new InteractiveHexManager(scene, groundWithRisingEdge(0.4), AT_ORIGIN as never);
    expect(bandHeight(manager, scene)).toBeGreaterThan(0.4);
  });

  it("only reads its centre where it is not drawn", () => {
    const scene = new THREE.Scene();
    const manager = new InteractiveHexManager(scene, groundWithRisingEdge(0.4), AT_ORIGIN as never);
    manager.setSurfaceVisibility(false);
    expect(bandHeight(manager, scene)).toBeLessThan(0.4);
  });
});
