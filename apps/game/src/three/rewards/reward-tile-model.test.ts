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
    expect(model.instancedMeshes[0].morphTexture).toBeNull();
    expect(model.instancedMeshes[0].morphTargetInfluences).toEqual([0.75]);
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
    expect(model.instancedMeshes[0].count).toBe(1);
    model.instancedMeshes[0].getMatrixAt(1, actual);
    expect(actual.determinant()).toBe(0);
    expect(() => model.setMatrixAt(4, new Matrix4())).toThrow(RangeError);
    model.dispose();
  });
});

describe("chest camera facing", () => {
  it("faces each chest toward the camera without rotating its altar or losing its tile placement", () => {
    const asset = createAsset();
    asset.scene.clear();
    asset.animations = [];
    const body = new Group();
    body.name = "ChestBody";
    const chest = new Mesh(new PlaneGeometry(), new MeshStandardMaterial());
    chest.name = "chest";
    body.add(chest);
    const altar = new Mesh(new PlaneGeometry(), new MeshStandardMaterial());
    altar.name = "altar";
    asset.scene.add(body, altar);
    const model = new RewardTileModel(asset, 2);
    model.setMatrixAt(0, new Matrix4());
    model.setMatrixAt(1, new Matrix4().makeTranslation(20, 0, 0));
    model.setCount(2);
    model.updatePresentation(0, new Vector3(10, 8, 10));
    model.updateAnimations(0);
    const matrix = new Matrix4();
    const chestMesh = model.instancedMeshes.find((mesh) => mesh.name === "chest")!;
    const altarMesh = model.instancedMeshes.find((mesh) => mesh.name === "altar")!;
    for (const index of [0, 1]) {
      chestMesh.getMatrixAt(index, matrix);
      const forward = new Vector3(0, 0, 1).transformDirection(matrix);
      expect(forward.x).toBeCloseTo(index === 0 ? Math.SQRT1_2 : -Math.SQRT1_2);
      expect(forward.z).toBeCloseTo(Math.SQRT1_2);
      expect(new Vector3().setFromMatrixPosition(matrix).x).toBe(index * 20);
      altarMesh.getMatrixAt(index, matrix);
      expect(new Vector3(0, 0, 1).transformDirection(matrix).toArray()).toEqual([0, 0, 1]);
    }
    model.updatePresentation(1, new Vector3(-10, 8, -10));
    model.updateAnimations(0);
    chestMesh.getMatrixAt(0, matrix);
    expect(new Vector3(0, 0, 1).transformDirection(matrix).z).toBeCloseTo(-Math.SQRT1_2);
    model.dispose();
  });
});

describe("reward animation uploads", () => {
  it("uploads only changed slots and leaves stationary parts clean at GPU precision", () => {
    const asset = createAsset();
    const stationary = new Mesh(new PlaneGeometry(), new MeshStandardMaterial());
    stationary.name = "Basin";
    stationary.rotation.y = 0.123;
    asset.scene.add(stationary);
    const model = new RewardTileModel(asset, 1000);
    model.setMatrixAt(2, new Matrix4().makeTranslation(10, 0, 0));
    model.setCount(3);
    const basin = model.instancedMeshes.find((mesh) => mesh.name === "Basin")!;
    const moving = model.instancedMeshes.find((mesh) => mesh.name === "Liquid")!;
    model.instancedMeshes.forEach((mesh) => mesh.instanceMatrix.clearUpdateRanges());
    const basinVersion = basin.instanceMatrix.version;
    model.updateAnimations(0.1);
    expect(basin.instanceMatrix.version).toBe(basinVersion);
    expect(basin.instanceMatrix.updateRanges).toEqual([]);
    expect(moving.instanceMatrix.updateRanges).toEqual([{ start: 32, count: 16 }]);
    for (let frame = 0; frame < 100; frame++) model.updateAnimations(1 / 60);
    expect(moving.instanceMatrix.updateRanges).toEqual([{ start: 32, count: 16 }]);
    model.removeInstance(2);
    expect(basin.instanceMatrix.updateRanges).toEqual([{ start: 32, count: 16 }]);
    const removed = new Matrix4();
    basin.getMatrixAt(2, removed);
    expect(removed.determinant()).toBe(0);
    model.dispose();
  });

  it("shares the current morph pose across sparse instances without capacity-sized textures", () => {
    const model = new RewardTileModel(createAsset(), 1000);
    model.setMatrixAt(0, new Matrix4());
    model.setMatrixAt(7, new Matrix4().makeTranslation(10, 0, 0));
    model.setCount(8);
    const mesh = model.instancedMeshes[0];
    const influences = mesh.morphTargetInfluences;
    expect(influences).toEqual([0.5]);
    model.updateAnimations(0.5);
    expect(mesh.morphTargetInfluences).toBe(influences);
    expect(influences).toEqual([0.75]);
    expect(mesh.morphTexture).toBeNull();
    expect(mesh.count).toBe(8);
    model.setCount(0);
    expect(mesh.count).toBe(0);
    expect(mesh.visible).toBe(false);
    model.setMatrixAt(0, new Matrix4());
    model.setCount(1);
    expect(mesh.count).toBe(1);
    expect(mesh.morphTargetInfluences).toBe(influences);
    model.dispose();
  });
});
