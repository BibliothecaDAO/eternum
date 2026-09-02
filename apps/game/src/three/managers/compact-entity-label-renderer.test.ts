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

const batchesOf = (renderer: CompactEntityLabelRenderer): THREE.BatchedMesh[] =>
  (renderer as unknown as { group: THREE.Group }).group.children as THREE.BatchedMesh[];

const instanceMatrixOf = (renderer: CompactEntityLabelRenderer, entityId: number): THREE.Matrix4 => {
  const label = (
    renderer as unknown as { labels: Map<number, { batch: { mesh: THREE.BatchedMesh }; instanceId: number }> }
  ).labels.get(entityId)!;
  const matrix = new THREE.Matrix4();
  label.batch.mesh.getMatrixAt(label.instanceId, matrix);
  return matrix;
};

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
  it("draws every label on an atlas page as one batched mesh with a plain material", () => {
    const scene = new THREE.Scene();
    const renderer = createRenderer(scene);

    for (let entityId = 1; entityId <= 50; entityId += 1) {
      renderer.setLabel({
        entityId,
        position: new THREE.Vector3(entityId, 0, 0),
        text: entityId % 2 === 0 ? "Even" : "Odd",
        variant: entityId % 3 === 0 ? "ally" : "enemy",
      });
    }

    const batches = batchesOf(renderer);
    expect(batches).toHaveLength(1);
    expect(renderer.drawCount).toBe(1);
    expect(batches[0]).toBeInstanceOf(THREE.BatchedMesh);
    expect(batches[0].material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((batches[0].material as THREE.MeshBasicMaterial).map).toBeInstanceOf(THREE.CanvasTexture);
    expect(batches[0].material).not.toBeInstanceOf(THREE.ShaderMaterial);
    // Four distinct texts × variants share four quad geometries between fifty instances.
    expect(
      (renderer as unknown as { batches: Map<unknown, { geometryIdByKey: Map<string, unknown> }> }).batches
        .values()
        .next().value?.geometryIdByKey.size,
    ).toBe(4);
  });

  it("uses a compact default footprint and faces the active camera", () => {
    const scene = new THREE.Scene();
    const renderer = createRenderer(scene);
    const camera = new THREE.PerspectiveCamera();
    camera.rotation.set(0.2, 0.4, 0.6);
    camera.updateMatrixWorld();

    renderer.setLabel({ entityId: 1, position: new THREE.Vector3(3, 1, 2), text: "Facing", variant: "ally" });
    renderer.updateCamera(camera);

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    instanceMatrixOf(renderer, 1).decompose(position, quaternion, scale);
    expect(position.x).toBeCloseTo(3);
    expect(scale.y).toBeCloseTo(0.46);
    expect(scale.x).toBeGreaterThan(scale.y);
    expect(quaternion.x).toBeCloseTo(camera.quaternion.x);
    expect(quaternion.y).toBeCloseTo(camera.quaternion.y);
    expect(quaternion.z).toBeCloseTo(camera.quaternion.z);
  });

  it("keeps labels out of raycast picking", () => {
    const scene = new THREE.Scene();
    const renderer = createRenderer(scene);
    renderer.setLabel({ entityId: 1, position: new THREE.Vector3(), text: "Picked?", variant: "neutral" });

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObjects([scene], true)).toEqual([]);
  });

  it("reuses the page texture and material until the last label is removed", () => {
    const scene = new THREE.Scene();
    const renderer = createRenderer(scene);

    renderer.setLabel({ entityId: 1, position: new THREE.Vector3(), text: "Shared", variant: "enemy" });
    renderer.setLabel({ entityId: 2, position: new THREE.Vector3(1, 0, 0), text: "Shared", variant: "enemy" });

    const material = batchesOf(renderer)[0].material as THREE.MeshBasicMaterial;
    const texture = material.map as THREE.Texture;
    const materialDispose = vi.spyOn(material, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");

    renderer.removeLabel(1);
    expect(textureDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();
    expect(batchesOf(renderer)).toHaveLength(1);

    renderer.removeLabel(2);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(batchesOf(renderer)).toHaveLength(0);
  });

  it("scales the hovered label up and back", () => {
    const scene = new THREE.Scene();
    const renderer = createRenderer(scene);
    renderer.setLabel({ entityId: 7, position: new THREE.Vector3(), text: "Hover", variant: "mine" });

    const scale = new THREE.Vector3();
    instanceMatrixOf(renderer, 7).decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    const restingHeight = scale.y;

    renderer.setHover(7);
    instanceMatrixOf(renderer, 7).decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    expect(scale.y).toBeCloseTo(restingHeight * 1.12);

    renderer.clearHover();
    instanceMatrixOf(renderer, 7).decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    expect(scale.y).toBeCloseTo(restingHeight);
  });

  it("retains only the labels whose entity is still placed", () => {
    const scene = new THREE.Scene();
    const renderer = createRenderer(scene);
    for (const entityId of [1, 2, 3]) {
      renderer.setLabel({
        entityId,
        position: new THREE.Vector3(entityId, 0, 0),
        text: `T${entityId}`,
        variant: "enemy",
      });
    }

    renderer.retainOnly([2]);

    const labels = (renderer as unknown as { labels: Map<number, unknown> }).labels;
    expect([...labels.keys()]).toEqual([2]);
  });
});
