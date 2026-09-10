import { describe, expect, it } from "vitest";
import {
  AnimationClip,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NumberKeyframeTrack,
  PlaneGeometry,
  Vector3,
  VectorKeyframeTrack,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { RewardTileModel } from "./reward-tile-model";

function createAsset(): GLTF {
  const scene = new Group();
  const pivot = new Group();
  pivot.name = "MovingPivot";
  pivot.position.set(1, 2, 3);
  const geometry = new PlaneGeometry();
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [new Float32BufferAttribute(geometry.attributes.position.array.slice(), 3)];
  const mesh = new Mesh(geometry, new MeshStandardMaterial());
  mesh.name = "Liquid";
  mesh.position.set(0.25, 0, 0);
  mesh.scale.setScalar(0.5);
  pivot.add(mesh);
  scene.add(pivot);
  return {
    scene,
    scenes: [scene],
    animations: [
      new AnimationClip("flow", 2, [
        new VectorKeyframeTrack("MovingPivot.position", [0, 2], [1, 2, 3, 1, 4, 3]),
        new NumberKeyframeTrack("Liquid.morphTargetInfluences[0]", [0, 2], [0, 1]),
      ]),
    ],
    cameras: [],
    asset: { version: "2.0" },
    parser: {} as GLTF["parser"],
    userData: {},
  };
}

describe("instanced reward hierarchies", () => {
  it("composes nested animated pivots and quantized mesh scale after tile placement", () => {
    const model = new RewardTileModel(createAsset(), 4);
    const placement = new Matrix4().makeRotationY(Math.PI / 2).setPosition(10, 0, -5);
    model.setMatrixAt(0, placement);
    model.setCount(1);
    const actual = new Matrix4();
    model.instancedMeshes[0].getMatrixAt(0, actual);
    const position = new Vector3().setFromMatrixPosition(actual);
    expect(position.x).toBeCloseTo(13);
    expect(position.y).toBeCloseTo(3);
    expect(position.z).toBeCloseTo(-6.25);
    expect(new Vector3().setFromMatrixScale(actual).x).toBeCloseTo(0.5);
    model.updateAnimations(0.5);
    model.instancedMeshes[0].getMatrixAt(0, actual);
    expect(new Vector3().setFromMatrixPosition(actual).y).toBeCloseTo(3.5);
    expect(model.instancedMeshes[0].morphTexture?.image.height).toBe(4);
    model.dispose();
  });
  it("keeps sparse slots hidden and drops truncated placements before animation updates", () => {
    const model = new RewardTileModel(createAsset(), 4);
    model.setMatrixAt(0, new Matrix4());
    model.setMatrixAt(2, new Matrix4().makeTranslation(10, 0, 0));
    model.setCount(3);
    model.removeInstance(0);
    model.updateAnimations(0.1);
    const actual = new Matrix4();
    model.instancedMeshes[0].getMatrixAt(0, actual);
    expect(actual.determinant()).toBe(0);
    model.setCount(1);
    expect(model.instancedMeshes[0].count).toBe(2);
    model.instancedMeshes[0].getMatrixAt(1, actual);
    expect(actual.determinant()).toBe(0);
    expect(() => model.setMatrixAt(4, new Matrix4())).toThrow(RangeError);
    model.dispose();
  });
});
