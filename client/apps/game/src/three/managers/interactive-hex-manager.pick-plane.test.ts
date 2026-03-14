import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("@/three/constants", () => ({
  HEX_SIZE: 1,
}));

vi.mock("../constants", () => ({
  HEX_SIZE: 1,
}));

vi.mock("@/three/managers/aura", () => ({
  Aura: class {
    setPosition() {}
    isInScene() {
      return false;
    }
    addToScene() {}
    removeFromScene() {}
    rotate() {}
    dispose() {}
  },
}));

vi.mock("@/three/managers/hover-hex-manager", () => ({
  HoverHexManager: class {
    showHover() {}
    hideHover() {}
    update() {}
    dispose() {}
    setHoverColor() {}
    setHoverIntensity() {}
  },
}));

vi.mock("@/three/shaders/border-hex-material", () => ({
  interactiveHexMaterial: new THREE.MeshStandardMaterial(),
}));

vi.mock("@/three/utils/hex-geometry-debug", () => ({
  hexGeometryDebugger: {
    trackSharedGeometryUsage() {},
  },
}));

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

vi.mock("@/three/utils/performance-monitor", () => ({
  PerformanceMonitor: class {},
}));

vi.mock("../utils/utils", () => ({
  getHexForWorldPosition: () => ({ col: 0, row: 0 }),
  getWorldPositionForHex: () => new THREE.Vector3(),
  getWorldPositionForHexCoordsInto: (_col: number, _row: number, out: THREE.Vector3) => out.set(0, 0, 0),
}));

const { InteractiveHexManager } = await import("./interactive-hex-manager");

type PickHexFromRaycasterCallable = {
  pickHexFromRaycaster: (raycaster: THREE.Raycaster) => unknown;
};

describe("InteractiveHexManager pickHexFromRaycaster", () => {
  it("projects picks onto the ground plane instead of the elevated interaction surface", () => {
    const resolveHexFromPoint = vi.fn(() => null);
    const subject = {
      instanceMesh: {},
      pickIntersection: new THREE.Vector3(),
      resolveHexFromPoint,
      pickHexFromRaycast: vi.fn(() => null),
    };
    const callable = Object.assign(Object.create(InteractiveHexManager.prototype), subject) as PickHexFromRaycasterCallable;
    const raycaster = {
      ray: new THREE.Ray(new THREE.Vector3(6, 10, -2), new THREE.Vector3(-0.3, -1, 0.4).normalize()),
      intersectObject: vi.fn(),
    } as unknown as THREE.Raycaster;

    callable.pickHexFromRaycaster(raycaster);

    expect(resolveHexFromPoint).toHaveBeenCalledTimes(1);
    const intersection = resolveHexFromPoint.mock.calls[0][0] as THREE.Vector3;
    const t = -raycaster.ray.origin.y / raycaster.ray.direction.y;
    const expected = raycaster.ray.direction.clone().multiplyScalar(t).add(raycaster.ray.origin);

    expect(intersection.x).toBeCloseTo(expected.x, 6);
    expect(intersection.y).toBeCloseTo(0, 6);
    expect(intersection.z).toBeCloseTo(expected.z, 6);
  });
});
