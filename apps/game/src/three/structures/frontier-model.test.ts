import { describe, it, expect, vi } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Matrix4, InstancedMesh, Texture } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { FRONTIER_BEASTS } from "./frontier-beast";
import type { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";
import { FrontierModel, frontierModelKind } from "./frontier-model";
import { BEASTS } from "@bibliothecadao/types";

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
    model.setCount(0);
    expect(mist.count).toBe(0);
    const dispose = vi.fn();
    mist.geometry.addEventListener("dispose", dispose);
    model.dispose();
    model.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
  it("gives each instance on one model its own beast's idle, so a Kappa breathes where a Fairy hovers", () => {
    const { gltf } = source();
    const model = new FrontierModel(gltf, 4, "dark-fey");
    model.setIdleAt(0, BEASTS.fairy.idle);
    model.setIdleAt(1, BEASTS.kappa.idle);
    const idle = model.instancedMeshes[0].geometry.getAttribute("beastIdle");
    expect([idle.getX(0), idle.getX(1), idle.getY(1), idle.getZ(1)]).toEqual([
      2,
      0,
      Math.fround(1.6),
      Math.fround(0.012),
    ]);
    const wraith = new FrontierModel(source().gltf, 2, "wraith");
    wraith.setIdleAt(1, BEASTS.lich.idle);
    const lifted = wraith.instancedMeshes[0].geometry.getAttribute("beastIdle");
    expect([lifted.getX(1), lifted.getY(1), lifted.getZ(1)]).toEqual([1, Math.fround(0.9), Math.fround(0.02)]);
  });
  it.each(Object.entries(FRONTIER_BEASTS))(
    "animates %s through the production catalog, retaining paint, placements and cached geometry",
    (species, { path }) => {
      const { gltf, geometry } = source();
      const dispose = vi.fn();
      geometry.addEventListener("dispose", dispose);
      const kind = frontierModelKind(path)!;
      expect(kind).toBe(species);
      const model = new FrontierModel(gltf, 10, kind);
      const mesh = model.instancedMeshes[0];
      expect(mesh.geometry).not.toBe(geometry);
      expect((mesh.material as MeshStandardMaterial).map).not.toBeNull();
      expect((mesh.material as MeshStandardMaterial).normalMap).not.toBeNull();
      expect(mesh.geometry.boundingBox!.max.x).toBeGreaterThan(0.25);
      const material = mesh.material as FrostedStandardNodeMaterial;
      expect(material.positionNode).not.toBeNull();
      expect(material.emissiveNode).not.toBeNull();
      const embers = model.group.getObjectByName("Beast phoenix embers") as InstancedMesh;
      expect(embers).toBeInstanceOf(InstancedMesh);
      expect(embers.instanceMatrix).toBe(mesh.instanceMatrix);
      expect(embers.geometry.index!.count / 3).toBe(20);
      model.setLayerAt(3, 2);
      expect(mesh.geometry.getAttribute("beastLayer").getX(3)).toBe(2);
      expect(embers.geometry.getAttribute("beastLayer")).toBe(mesh.geometry.getAttribute("beastLayer"));
      model.setCount(4);
      expect(embers.count).toBe(4);
      const matrix = new Matrix4().makeTranslation(9, 2, 8);
      model.setMatrixAt(3, matrix);
      const actual = new Matrix4();
      mesh.getMatrixAt(3, actual);
      expect(actual.elements).toEqual(matrix.elements);
      const materialDispose = vi.fn();
      const emberDispose = vi.fn();
      material.addEventListener("dispose", materialDispose);
      embers.geometry.addEventListener("dispose", emberDispose);
      model.dispose();
      model.dispose();
      expect(materialDispose).toHaveBeenCalledTimes(1);
      expect(emberDispose).toHaveBeenCalledTimes(1);
      expect(dispose).not.toHaveBeenCalled();
    },
  );
});
