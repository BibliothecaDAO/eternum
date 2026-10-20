import { describe, it, expect, vi } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Matrix4, InstancedMesh, Texture } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { FrontierModel } from "./frontier-model";

function source() {
  const geometry = new BoxGeometry(0.5, 0.5, 0.5);
  const material = new MeshStandardMaterial({ map: new Texture(), normalMap: new Texture() });
  const scene = new Group();
  scene.add(new Mesh(geometry, material));
  return { gltf: { scene, animations: [] } as unknown as GLTF, geometry };
}

describe("Frontier effects on real instance placements", () => {
  it("shares a hundred ruin transforms with one six-triangle mist batch and hides it when cleared", () => {
    const { gltf } = source();
    const model = new FrontierModel(gltf, 100, "ruin");
    const mist = model.group.getObjectByName("Ruin ground mist") as InstancedMesh;
    const placement = new Matrix4().makeTranslation(7, 2, 4);
    model.setMatrixAt(9, placement);
    model.setCount(100);
    expect(mist.count).toBe(100);
    expect(mist.instanceMatrix).toBe(model.instancedMeshes[0].instanceMatrix);
    const actual = new Matrix4();
    mist.getMatrixAt(9, actual);
    expect(actual.elements).toEqual(placement.elements);
    expect(mist.geometry.index!.count / 3).toBe(6);
    model.setMistVisible(false);
    expect(mist.visible).toBe(false);
    model.setMistVisible(true);
    expect(mist.visible).toBe(true);
    model.setCount(0);
    expect(mist.count).toBe(0);
    const dispose = vi.fn();
    mist.geometry.addEventListener("dispose", dispose);
    model.dispose();
    model.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
  it("retains the fey paint and normal map while isolating animated bounds from the cached source", () => {
    const { gltf, geometry } = source();
    const dispose = vi.fn();
    geometry.addEventListener("dispose", dispose);
    const model = new FrontierModel(gltf, 10, "fey");
    const mesh = model.instancedMeshes[0];
    expect(mesh.geometry).not.toBe(geometry);
    expect((mesh.material as MeshStandardMaterial).map).not.toBeNull();
    expect((mesh.material as MeshStandardMaterial).normalMap).not.toBeNull();
    expect(mesh.geometry.boundingBox!.max.x).toBeGreaterThan(0.25);
    model.dispose();
    expect(dispose).not.toHaveBeenCalled();
  });
});
