import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("@/three/constants", () => ({ HEX_SIZE: 1 }));
vi.mock("../constants", () => ({ HEX_SIZE: 1 }));
vi.mock("@/three/managers/aura", () => ({
  Aura: class {
    setPosition() {}
    isInScene() {
      return false;
    }
    addToScene() {}
    removeFromScene() {}
    dispose() {}
  },
}));
vi.mock("@/three/managers/hover-hex-manager", () => ({
  HoverHexManager: class {
    dispose() {}
  },
}));
vi.mock("@/three/shaders/border-hex-material", () => ({ interactiveHexMaterial: new THREE.MeshBasicMaterial() }));
vi.mock("@/three/utils/hex-geometry-debug", () => ({ hexGeometryDebugger: { trackSharedGeometryUsage() {} } }));
vi.mock("@/three/utils/hex-geometry-pool", () => ({
  HexGeometryPool: class {
    static getInstance() {
      return new this();
    }
    getGeometry() {
      return new THREE.BufferGeometry();
    }
    releaseGeometry() {}
  },
}));
vi.mock("@/three/utils/performance-monitor", () => ({ PerformanceMonitor: { begin() {}, end() {} } }));
vi.mock("../utils/utils", () => ({
  getHexForWorldPosition: () => ({ col: 0, row: 0 }),
  getWorldPositionForHex: ({ col }: { col: number }) => new THREE.Vector3(col * 2, 0, 0),
  getWorldPositionForHexCoordsInto: (col: number, _row: number, out: THREE.Vector3) => out.set(col * 2, 0, 0),
}));

const { InteractiveHexManager } = await import("./interactive-hex-manager");

describe("InteractiveHexManager surface", () => {
  it("lays every band on the sampled ground plus a small lift", () => {
    const scene = new THREE.Scene();
    const manager = new InteractiveHexManager(scene, { sampleSurface: (x) => ({ height: x / 4 }) as never });
    manager.addHex({ col: 0, row: 0 });
    manager.addHex({ col: 4, row: 0 });

    manager.renderAllHexes();

    const mesh = scene.children.find((child) => child instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    mesh.getMatrixAt(0, matrix);
    expect(position.setFromMatrixPosition(matrix).y).toBeCloseTo(0.03);
    mesh.getMatrixAt(1, matrix);
    expect(position.setFromMatrixPosition(matrix).y).toBeCloseTo(2.03);
    expect(mesh.count).toBe(2);
    expect(mesh.visible).toBe(true);
  });
});
