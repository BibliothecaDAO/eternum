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
  VectorKeyframeTrack,
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
  base.userData.spirePart = "base";
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
  const current = new Group();
  current.name = "current";
  const light = new Mesh(new PlaneGeometry(), new MeshStandardMaterial({ transparent: true }));
  light.userData.spirePart = "portalCurrentSurface";
  light.name = "light";
  current.add(light);
  portalRoot.add(current);
  scene.add(portalRoot);
  const clip = new AnimationClip("Spire_Loop", 8, [
    new NumberKeyframeTrack("hover.position[y]", [0, 2, 4, 6, 8], [0, 0.026, 0, -0.026, 0]),
    new VectorKeyframeTrack(
      "current.position",
      [0, 3.9, 4, 4.1, 8],
      [0.4, 0, 0, 0.1, 0, 0, 0.4, 0, 0, 0.39, 0, 0, 0.4, 0, 0],
    ),
    new VectorKeyframeTrack(
      "current.scale",
      [0, 0.1, 3.9, 4, 4.1, 7.9, 8],
      [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
    ),
  ]);
  const gltf = { scene, animations: [clip] } as unknown as GLTF;
  return { gltf, shard, core, light, stone, model: new SpireModel(gltf, 4) };
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
  it("retains nested transforms, stable placement phases and the authored loop without mutating the loader cache", () => {
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
  it("keeps resetting currents invisible and rear light on the same animated matrix", () => {
    const { model } = fixture();
    model.setMatrixAt(0, new Matrix4());
    model.setCount(1);
    model.updateAnimations(4);
    model.group.updateMatrixWorld(true);
    const light = portals(model)[0].getObjectByName("light") as Mesh;
    expect(light.matrix.determinant()).toBe(0);
    expect(light.children[0].matrixWorld.elements).toEqual(light.matrixWorld.elements);
    model.updateAnimations(0.2);
    expect(light.matrix.determinant()).toBeGreaterThan(0);
    model.dispose();
  });
  it("sorts complete portals after a camera reversal while retaining rear/core/front order", () => {
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
    const light = far.getObjectByName("light") as Mesh;
    expect(light.renderOrder).toBe(3);
    expect(light.children[0].renderOrder).toBe(1);
    camera.position.z = -10;
    camera.lookAt(0, 0, 0);
    model.updateAnimations(0, { camera });
    expect(far.renderOrder).toBeGreaterThan(near.renderOrder);
    model.dispose();
  });
  it("removes every transparent pass with its slot and releases only owned resources exactly once", () => {
    const { model, core, stone, light } = fixture();
    const references = MaterialPool.getInstance().getStats().totalReferences;
    const sourceDisposal = vi.spyOn(core.geometry, "dispose");
    const sourceMaterialDisposal = vi.spyOn(stone, "dispose");
    const sourceLightDisposal = vi.spyOn(light.material as MeshStandardMaterial, "dispose");
    model.setMatrixAt(0, new Matrix4());
    model.setCount(1);
    const material = (portals(model)[0].getObjectByName("light") as Mesh).material as MeshStandardMaterial;
    const ownedDisposal = vi.spyOn(material, "dispose");
    model.removeInstance(0);
    model.updateAnimations(1);
    expect(matrixAt(model, 0).determinant()).toBe(0);
    expect(portals(model)).toHaveLength(0);
    model.setMatrixAt(0, new Matrix4());
    model.setCount(0);
    expect(portals(model)).toHaveLength(0);
    model.dispose();
    model.dispose();
    expect(ownedDisposal).toHaveBeenCalledOnce();
    expect(sourceDisposal).not.toHaveBeenCalled();
    expect(sourceMaterialDisposal).not.toHaveBeenCalled();
    expect(sourceLightDisposal).not.toHaveBeenCalled();
    expect(MaterialPool.getInstance().getStats().totalReferences).toBe(references - 2);
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
