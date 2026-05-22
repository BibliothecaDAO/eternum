import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompactEntityLabelRenderer } from "./compact-entity-label-renderer";

function createCanvasElement() {
  return {
    getContext: vi.fn(() => ({
      beginPath: vi.fn(),
      clearRect: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      lineTo: vi.fn(),
      measureText: vi.fn((text: string) => ({ width: text.length * 9 })),
      quadraticCurveTo: vi.fn(),
      roundRect: vi.fn(),
      stroke: vi.fn(),
    })),
    height: 0,
    width: 0,
  } as unknown as HTMLCanvasElement;
}

beforeEach(() => {
  vi.stubGlobal("document", {
    createElement: vi.fn((tagName: string) => {
      if (tagName === "canvas") {
        return createCanvasElement();
      }
      throw new Error(`Unexpected element ${tagName}`);
    }),
  });
});

describe("CompactEntityLabelRenderer", () => {
  it("renders labels with WebGPU-safe mesh materials", () => {
    const scene = new THREE.Scene();
    const renderer = new CompactEntityLabelRenderer(scene);

    renderer.setLabel({
      entityId: 1,
      position: new THREE.Vector3(1, 2, 3),
      text: "Sable Order",
      variant: "mine",
    });

    const group = (renderer as unknown as { group: THREE.Group }).group;
    const mesh = group.children[0] as THREE.Mesh;

    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((mesh.material as THREE.MeshBasicMaterial).map).toBeInstanceOf(THREE.CanvasTexture);
    expect(mesh).not.toBeInstanceOf(THREE.Sprite);
    expect(mesh.material).not.toBeInstanceOf(THREE.ShaderMaterial);
  });

  it("uses a compact default footprint for always-on map labels", () => {
    const scene = new THREE.Scene();
    const renderer = new CompactEntityLabelRenderer(scene);

    renderer.setLabel({
      entityId: 1,
      position: new THREE.Vector3(),
      text: "Sable Order",
      variant: "mine",
    });

    const group = (renderer as unknown as { group: THREE.Group }).group;
    const mesh = group.children[0] as THREE.Mesh;
    const textureCache = renderer as unknown as {
      textureCache: Map<string, { height: number }>;
    };
    const textureRecord = [...textureCache.textureCache.values()][0];

    expect(mesh.scale.y).toBeCloseTo(0.46);
    expect(textureRecord.height).toBe(34);
  });

  it("keeps visual labels out of raycast picking", () => {
    const scene = new THREE.Scene();
    const renderer = new CompactEntityLabelRenderer(scene);

    renderer.setLabel({
      entityId: 1,
      position: new THREE.Vector3(),
      text: "Sable Order",
      variant: "mine",
    });

    const group = (renderer as unknown as { group: THREE.Group }).group;
    const mesh = group.children[0] as THREE.Mesh;
    const intersections: THREE.Intersection[] = [];

    mesh.raycast(new THREE.Raycaster(), intersections);

    expect(intersections).toEqual([]);
  });

  it("reuses cached textures and releases them after the last label is removed", () => {
    const scene = new THREE.Scene();
    const renderer = new CompactEntityLabelRenderer(scene);

    renderer.setLabel({
      entityId: 1,
      position: new THREE.Vector3(),
      text: "Shared",
      variant: "enemy",
    });
    renderer.setLabel({
      entityId: 2,
      position: new THREE.Vector3(1, 0, 0),
      text: "Shared",
      variant: "enemy",
    });

    const textureCache = renderer as unknown as {
      textureCache: Map<string, { texture: THREE.Texture }>;
    };
    const texture = [...textureCache.textureCache.values()][0].texture;
    const textureDispose = vi.spyOn(texture, "dispose");

    renderer.removeLabel(1);
    expect(textureDispose).not.toHaveBeenCalled();

    renderer.removeLabel(2);
    expect(textureDispose).toHaveBeenCalledTimes(1);
  });

  it("faces labels toward the active camera", () => {
    const scene = new THREE.Scene();
    const renderer = new CompactEntityLabelRenderer(scene);
    const camera = new THREE.PerspectiveCamera();
    camera.rotation.set(0.2, 0.4, 0.6);
    camera.updateMatrixWorld();

    renderer.setLabel({
      entityId: 1,
      position: new THREE.Vector3(),
      text: "Facing",
      variant: "ally",
    });
    renderer.updateCamera(camera);

    const group = (renderer as unknown as { group: THREE.Group }).group;
    const mesh = group.children[0] as THREE.Mesh;

    expect(mesh.quaternion.x).toBeCloseTo(camera.quaternion.x);
    expect(mesh.quaternion.y).toBeCloseTo(camera.quaternion.y);
    expect(mesh.quaternion.z).toBeCloseTo(camera.quaternion.z);
    expect(mesh.quaternion.w).toBeCloseTo(camera.quaternion.w);
  });
});
