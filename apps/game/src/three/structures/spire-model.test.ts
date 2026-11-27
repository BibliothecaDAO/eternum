import {
  AnimationClip,
  AnimationMixer,
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NumberKeyframeTrack,
  OrthographicCamera,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";
import { placedModelPhase } from "../utils/placed-model-phase";
import { MaterialPool } from "../utils/material-pool";
import { SpireModel } from "./spire-model";

vi.mock("../utils/contact-shadow", () => ({
  getContactShadowResources: () => ({ geometry: new PlaneGeometry(), material: new MeshBasicMaterial() }),
}));

function fixture() {
  const scene = new Group();
  const stone = new MeshStandardMaterial();
  const base = new Mesh(new BoxGeometry(), stone);
  base.name = "base";
  base.userData.spirePart = "outcrop";
  scene.add(base);
  const hover = new Group();
  hover.name = "hover";
  const shard = new Mesh(new BoxGeometry(), stone);
  shard.name = "shard";
  shard.userData.spirePart = "spire";
  shard.position.y = 3;
  hover.add(shard);
  scene.add(hover);
  const portalRoot = new Group();
  portalRoot.position.y = 0.53;
  const core = new Mesh(new SphereGeometry(0.3), new MeshStandardMaterial({ transparent: true, opacity: 0.7 }));
  core.name = "core";
  core.userData = { spirePart: "portal", trueSphereRadius: 0.3 };
  portalRoot.add(core);
  scene.add(portalRoot);
  const clip = new AnimationClip("Spire_Loop", 8, [
    new NumberKeyframeTrack("hover.position[y]", [0, 2, 4, 6, 8], [0, 0.026, 0, -0.026, 0]),
  ]);
  const gltf = { scene, animations: [clip] } as unknown as GLTF;
  return { gltf, shard, core, stone, model: new SpireModel(gltf, 4) };
}

function matrixAt(model: SpireModel, part: number, index = 0) {
  const matrix = new Matrix4();
  model.instancedMeshes[part].getMatrixAt(index, matrix);
  return matrix;
}

function portals(model: SpireModel) {
  return model.group.children.filter((child) => child.name === "Spire dimensional portal") as Group[];
}

describe("authored spire animation", () => {
  it("retains nested transforms, stable placement phases and the authored loop without mutating the source kit", () => {
    const { model, gltf, shard } = fixture();
    const placement = new Matrix4().makeTranslation(3, 0.2, 7);
    model.setMatrixAt(0, placement);
    model.setMatrixAt(1, new Matrix4().makeTranslation(-4, 0, 0));
    model.setCount(2);
    model.updateAnimations(1.37);
    expect(matrixAt(model, 0).elements).toEqual(placement.elements.map(Math.fround));
    const reference = gltf.scene.clone(true);
    const mixer = new AnimationMixer(reference);
    mixer.clipAction(gltf.animations[0]).play();
    mixer.setTime(1.37 + placedModelPhase(3, 7) * 8);
    reference.updateMatrixWorld(true);
    const expected = placement.clone().multiply(reference.getObjectByName("shard")!.matrixWorld);
    expect(matrixAt(model, 1).elements).toEqual(expected.elements.map(Math.fround));
    const before = matrixAt(model, 1);
    model.updateAnimations(8);
    expect(matrixAt(model, 1).elements).toEqual(before.elements);
    model.setMatrixAt(2, placement);
    model.setCount(3);
    expect(matrixAt(model, 1, 2).elements).toEqual(before.elements);
    expect(shard.parent!.position.y).toBe(0);
    expect(shard.position.y).toBe(3);
    model.dispose();
  });

  it("sorts complete portals after a camera reversal while retaining portal core order", () => {
    const { model } = fixture();
    model.setMatrixAt(0, new Matrix4().makeTranslation(0, 0, -3));
    model.setMatrixAt(1, new Matrix4().makeTranslation(0, 0, 3));
    model.setCount(2);
    const camera = new OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    camera.position.z = 10;
    camera.lookAt(0, 0, 0);
    model.updateAnimations(0, { camera });
    const [far, near] = portals(model);
    expect(far.renderOrder).toBeLessThan(near.renderOrder);
    expect(far.getObjectByName("core")!.renderOrder).toBe(2);
    camera.position.z = -10;
    camera.lookAt(0, 0, 0);
    model.updateAnimations(0, { camera });
    expect(far.renderOrder).toBeGreaterThan(near.renderOrder);
    model.dispose();
  });

  it("removes every transparent pass with its slot and disposes owned kit resources once", () => {
    const { model, core, shard, stone } = fixture();
    const references = MaterialPool.getInstance().getStats().totalReferences;
    const shardGeometryDisposal = vi.spyOn(shard.geometry, "dispose");
    const coreGeometryDisposal = vi.spyOn(core.geometry, "dispose");
    const coreMaterialDisposal = vi.spyOn(core.material as MeshStandardMaterial, "dispose");
    const sourceMaterialDisposal = vi.spyOn(stone, "dispose");
    model.setMatrixAt(0, new Matrix4());
    model.setCount(1);
    model.removeInstance(0);
    model.updateAnimations(1);
    expect(matrixAt(model, 0).determinant()).toBe(0);
    expect(portals(model)).toHaveLength(0);
    model.setMatrixAt(0, new Matrix4());
    model.setCount(0);
    expect(portals(model)).toHaveLength(0);
    model.dispose();
    model.dispose();
    expect(shardGeometryDisposal).toHaveBeenCalledOnce();
    expect(coreGeometryDisposal).toHaveBeenCalledOnce();
    expect(coreMaterialDisposal).toHaveBeenCalledOnce();
    expect(sourceMaterialDisposal).toHaveBeenCalledOnce();
    expect(MaterialPool.getInstance().getStats().totalReferences).toBe(references - 2);
  });

  it("stands a dormant spire without a portal, still in its first pose, and wakes it on a working placement", () => {
    const { model, gltf } = fixture();
    const placement = new Matrix4().makeTranslation(3, 0.2, 7);
    model.placeSpire(0, placement, true);
    model.setCount(1);
    model.updateAnimations(1.37);
    expect(portals(model)).toHaveLength(0);
    const reference = gltf.scene.clone(true);
    reference.updateMatrixWorld(true);
    const firstPose = placement.clone().multiply(reference.getObjectByName("shard")!.matrixWorld);
    expect(matrixAt(model, 1).elements).toEqual(firstPose.elements.map(Math.fround));
    model.setMatrixAt(0, placement);
    expect(portals(model)).toHaveLength(1);
    model.placeSpire(0, placement, true);
    expect(portals(model)).toHaveLength(0);
    model.dispose();
  });

  it("contracts the actual orb about its authored centre without moving the spire or mutating the asset", () => {
    const { model, core } = fixture();
    const placement = new Matrix4().makeTranslation(4, 2, 7);
    model.setMatrixAt(0, placement);
    model.setCount(1);
    const body = matrixAt(model, 1);
    const original = new Matrix4();
    expect(model.getOrbTransform(0, original)).toBe(true);
    const surface = portals(model)[0].getObjectByName("core") as Mesh;
    const centre = new Vector3().setFromMatrixPosition(surface.matrix);
    const beforeScale = new Vector3().setFromMatrixScale(surface.matrix);
    model.setOrbScale(0, 0.06);
    expect(new Vector3().setFromMatrixPosition(surface.matrix).distanceTo(centre)).toBeLessThan(1e-10);
    expect(new Vector3().setFromMatrixScale(surface.matrix).x).toBeCloseTo(beforeScale.x * 0.06);
    expect(matrixAt(model, 1).elements).toEqual(body.elements);
    const after = new Matrix4();
    model.getOrbTransform(0, after);
    expect(after.elements).toEqual(original.elements);
    expect(core.parent!.position.y).toBe(0.53);
    expect(model.getOrbTransform(3, after)).toBe(false);
    expect(() => model.setOrbScale(0, 0)).toThrow("positive");
    model.setOrbScale(0, 1);
    expect(new Vector3().setFromMatrixScale(surface.matrix).x).toBeCloseTo(beforeScale.x);
    model.dispose();
  });

  it("keeps labels and conservative bounds above every hovering pose", () => {
    const { model } = fixture();
    model.setMatrixAt(0, new Matrix4().makeTranslation(4, 2, 7));
    model.setCount(1);
    expect(model.labelHeight).toBeGreaterThan(3.5);
    for (let frame = 0; frame < 240; frame++) {
      model.updateAnimations(1 / 30);
      const center = new Vector3().setFromMatrixPosition(matrixAt(model, 1));
      expect(model.instancedMeshes[1].boundingSphere!.containsPoint(center)).toBe(true);
    }
    model.dispose();
  });
});
