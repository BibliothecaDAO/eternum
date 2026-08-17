import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompactEntityLabelRenderer } from "./compact-entity-label-renderer";

const renderers: CompactEntityLabelRenderer[] = [];

function createRenderer(scene: THREE.Scene): CompactEntityLabelRenderer {
  const renderer = new CompactEntityLabelRenderer(scene);
  renderers.push(renderer);
  return renderer;
}

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

afterEach(() => {
  renderers.splice(0).forEach((renderer) => renderer.dispose());
  vi.unstubAllGlobals();
});

describe("CompactEntityLabelRenderer", () => {
  it("renders labels with WebGPU-safe mesh materials", () => {
    const scene = new THREE.Scene();
    const renderer = createRenderer(scene);

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
    const renderer = createRenderer(scene);

    renderer.setLabel({
      entityId: 1,
      position: new THREE.Vector3(),
      text: "Sable Order",
      variant: "mine",
    });

    const group = (renderer as unknown as { group: THREE.Group }).group;
    const mesh = group.children[0] as THREE.Mesh;
    expect(mesh.scale.y).toBeCloseTo(0.46);
    expect(mesh.scale.x).toBeGreaterThan(mesh.scale.y);
  });

  it("keeps visual labels out of raycast picking", () => {
    const scene = new THREE.Scene();
    const renderer = createRenderer(scene);

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

  it("reuses cached textures and materials until the last label is removed", () => {
    const scene = new THREE.Scene();
    const renderer = createRenderer(scene);

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

    const group = (renderer as unknown as { group: THREE.Group }).group;
    const texture = ((group.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).map as THREE.Texture;
    expect((group.children[0] as THREE.Mesh).material).toBe((group.children[1] as THREE.Mesh).material);
    const materialDispose = vi.spyOn((group.children[0] as THREE.Mesh).material as THREE.Material, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");

    renderer.removeLabel(1);
    expect(textureDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();

    renderer.removeLabel(2);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });

  it("faces labels toward the active camera", () => {
    const scene = new THREE.Scene();
    const renderer = createRenderer(scene);
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

  it("shares one atlas material across different labels and renderer owners", () => {
    const armyRenderer = createRenderer(new THREE.Scene());
    const structureRenderer = createRenderer(new THREE.Scene());

    armyRenderer.setLabel({ entityId: 1, position: new THREE.Vector3(), text: "Army", variant: "mine" });
    structureRenderer.setLabel({
      entityId: 2,
      position: new THREE.Vector3(),
      text: "Structure",
      variant: "structure",
    });

    const armyGroup = (armyRenderer as unknown as { group: THREE.Group }).group;
    const structureGroup = (structureRenderer as unknown as { group: THREE.Group }).group;
    const armyMesh = armyGroup.children[0] as THREE.Mesh;
    const structureMesh = structureGroup.children[0] as THREE.Mesh;

    expect(armyMesh.material).toBe(structureMesh.material);
    expect(armyMesh.geometry).not.toBe(structureMesh.geometry);
    expect(armyMesh.geometry.getAttribute("uv").array).not.toEqual(structureMesh.geometry.getAttribute("uv").array);
  });

  it("coalesces multiple atlas changes into one upload per frame", () => {
    let uploadFrame: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      uploadFrame = callback;
      return 1;
    });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    const renderer = createRenderer(new THREE.Scene());

    renderer.setLabel({ entityId: 1, position: new THREE.Vector3(), text: "First", variant: "mine" });
    renderer.setLabel({ entityId: 2, position: new THREE.Vector3(), text: "Second", variant: "enemy" });
    const group = (renderer as unknown as { group: THREE.Group }).group;
    const texture = ((group.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).map as THREE.Texture;
    const versionBeforeUpload = texture.version;

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    uploadFrame?.(16);
    expect(texture.version).toBe(versionBeforeUpload + 1);
  });
});
