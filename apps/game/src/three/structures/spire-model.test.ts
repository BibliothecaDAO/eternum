import {
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";
import type InstancedModel from "../managers/instanced-model";
import { SpireModel } from "./spire-model";

vi.mock("../utils/contact-shadow", () => ({
  getContactShadowResources: () => ({ geometry: new PlaneGeometry(), material: new MeshBasicMaterial() }),
}));

function fixture() {
  const scene = new Group();
  for (const role of ["base", "orbit", "portal"]) {
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    mesh.userData.spirePart = role;
    scene.add(mesh);
  }
  return new SpireModel({ scene, animations: [] } as unknown as GLTF, 4);
}

describe("spire presentation", () => {
  it("keeps the base fixed while the obelisks orbit independently of each other and the camera", () => {
    const model = fixture();
    const placement = new Matrix4().makeTranslation(3, 0, 7);
    model.setMatrixAt(0, placement);
    model.setMatrixAt(1, new Matrix4().makeTranslation(-4, 0, 0));
    model.setCount(2);
    const [base, stones] = model.instancedMeshes;
    const fixed = new Matrix4();
    const first = new Matrix4();
    const second = new Matrix4();
    model.updateAnimations(5);
    base.getMatrixAt(0, fixed);
    expect(fixed.equals(placement)).toBe(true);
    stones.getMatrixAt(0, first);
    stones.getMatrixAt(1, second);
    expect(first.elements.slice(0, 12)).not.toEqual(second.elements.slice(0, 12));
    const animated: InstancedModel = model;
    animated.updateAnimations(0, { cameraPosition: new Vector3(-100, 80, 40) });
    stones.getMatrixAt(0, second);
    expect(first.elements.slice(0, 12)).toEqual(second.elements.slice(0, 12));
    base.getMatrixAt(0, fixed);
    expect(fixed.equals(placement)).toBe(true);
    model.setMatrixAt(2, placement);
    model.setCount(3);
    stones.getMatrixAt(2, first);
    expect(first.equals(second)).toBe(true);
    model.removeInstance(0);
    model.updateAnimations(1);
    stones.getMatrixAt(0, fixed);
    expect(fixed.determinant()).toBe(0);
    model.dispose();
  });
});
