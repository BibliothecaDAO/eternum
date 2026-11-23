import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnimationClip,
  Box3,
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NumberKeyframeTrack,
  PlaneGeometry,
  SphereGeometry,
  Sphere,
  Vector3,
} from "three";

// Documented load-sensitive file: full-suite worker contention starves the
// three.js setup past the default 5s and trips CI on green code. The generous
// budget keeps the material-semantics coverage instead of deleting it — the
// tests finish in ~2s when the machine isn't saturated.
vi.setConfig({ testTimeout: 30_000 });

vi.mock("../utils/contact-shadow", () => ({
  disposeContactShadowResources: vi.fn(),
  getContactShadowResources: () => ({
    geometry: new PlaneGeometry(1, 1),
    material: new MeshBasicMaterial({ color: 0x000000 }),
  }),
}));

function createInstancedModelTestGltf(material: MeshStandardMaterial) {
  const scene = new Group();
  const mesh = new Mesh(new SphereGeometry(1, 8, 8), material);
  mesh.name = "chest";
  scene.add(mesh);

  return {
    scene,
    animations: [],
  };
}

function createAnimatedMorphInstancedModelTestGltf(material: MeshStandardMaterial) {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.morphAttributes.position = [geometry.attributes.position.clone()];
  geometry.morphAttributes.normal = [geometry.attributes.normal.clone()];

  const scene = new Group();
  const mesh = new Mesh(geometry, material);
  mesh.name = "chest";
  scene.add(mesh);

  return {
    scene,
    animations: [
      new AnimationClip("Idle", 1, [new NumberKeyframeTrack("chest.morphTargetInfluences[0]", [0, 1], [0, 1])]),
    ],
  };
}

function readInstanceMatrix(modelMesh: { getMatrixAt(index: number, matrix: Matrix4): void }, index: number): Matrix4 {
  const matrix = new Matrix4();
  modelMesh.getMatrixAt(index, matrix);
  return matrix;
}

describe("InstancedModel material semantics", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal("navigator", {
      getBattery: vi.fn(async () => ({ charging: false })),
      userAgent: "vitest",
    });
  });

  it("preserves blended chest materials instead of forcing alpha-cutout depth writes", async () => {
    const { default: InstancedModel } = await import("./instanced-model");
    const transparentChestMaterial = new MeshStandardMaterial({
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
      emissiveIntensity: 4,
    });

    const model = new InstancedModel(createInstancedModelTestGltf(transparentChestMaterial), 1, false, "Chest");
    const chestMesh = model.instancedMeshes[0];
    const resolvedMaterial = chestMesh.material as MeshStandardMaterial;

    expect(resolvedMaterial.transparent).toBe(true);
    expect(resolvedMaterial.depthWrite).toBe(false);
    expect(resolvedMaterial.alphaTest).toBe(0);
    expect(resolvedMaterial.emissiveIntensity).toBe(1.5);
  });

  it.each(["castle", "knightlvl2", "chest"])(
    "casts shadows for current %s assets without legacy mesh names",
    async (name) => {
      const { default: InstancedModel } = await import("./instanced-model");
      const gltf = createInstancedModelTestGltf(new MeshStandardMaterial());
      gltf.scene.children[0].name = name;
      const model = new InstancedModel(gltf, 1, false, name);
      expect(model.instancedMeshes[0].castShadow).toBe(true);
      expect(model.instancedMeshes[0].receiveShadow).toBe(true);
      model.dispose();
    },
  );

  it("keeps terrain bases and blended glow cards out of the model shadow silhouette", async () => {
    const { default: InstancedModel } = await import("./instanced-model");
    const gltf = createInstancedModelTestGltf(new MeshStandardMaterial());
    gltf.scene.children[0].name = "land";
    const glow = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial({ transparent: true, depthWrite: false }));
    glow.name = "building_glow";
    gltf.scene.add(glow);
    const leaves = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial({ transparent: true, alphaTest: 0.5 }));
    leaves.name = "leaves";
    gltf.scene.add(leaves);
    const model = new InstancedModel(gltf, 1, false, "Chest");
    expect(model.instancedMeshes.map((mesh) => mesh.castShadow)).toEqual([false, false, true]);
    model.dispose();
  });

  it("keeps a grounded army's contact shadow on the surface when its authored origin is lowered", async () => {
    const { default: InstancedModel } = await import("./instanced-model");
    const model = new InstancedModel(createInstancedModelTestGltf(new MeshStandardMaterial()), 1, false, "Knight");
    model.setMatrixAt(0, new Matrix4().makeTranslation(2, 3 - 0.166, 4), 3);

    const shadow = model.group.children.find((child) => child.renderOrder === 9) as InstancedMesh;
    const matrix = new Matrix4();
    shadow.getMatrixAt(0, matrix);
    expect(matrix.elements[13]).toBeGreaterThanOrEqual(3);
    expect(matrix.elements[13]).toBeLessThan(3.03);
    model.instancedMeshes[0].getMatrixAt(0, matrix);
    expect(matrix.elements[13]).toBeCloseTo(2.834);
    model.dispose();
  });

  it("applies authoritative world bounds to instanced mesh culling bounds", async () => {
    const { default: InstancedModel } = await import("./instanced-model");
    const model = new InstancedModel(createInstancedModelTestGltf(new MeshStandardMaterial()), 1, false, "Chest");
    const bounds = {
      box: new Box3(new Vector3(-10, -2, -12), new Vector3(10, 8, 12)),
      sphere: new Sphere(new Vector3(2, 3, 4), 18),
    };

    model.setWorldBounds(bounds);

    const mesh = model.instancedMeshes[0];
    expect(mesh.frustumCulled).toBe(true);
    expect(mesh.boundingSphere?.center.toArray()).toEqual([2, 3, 4]);
    expect(mesh.boundingSphere?.radius).toBe(18);
    expect(mesh.boundingBox?.min.toArray()).toEqual([-10, -2, -12]);
    expect(mesh.boundingBox?.max.toArray()).toEqual([10, 8, 12]);
  });

  it("keeps animated morph instances on the WebGPU-safe morph texture path", async () => {
    const { default: InstancedModel } = await import("./instanced-model");
    const morphChestMaterial = new MeshStandardMaterial();
    const hiddenMatrix = new Matrix4().makeScale(0, 0, 0);
    const visibleMatrix = new Matrix4().makeTranslation(1, 2, 3);

    const model = new InstancedModel(createAnimatedMorphInstancedModelTestGltf(morphChestMaterial), 1, false, "Chest");
    const chestMesh = model.instancedMeshes[0];

    expect(chestMesh.morphTexture).not.toBeNull();
    expect(model.getCount()).toBe(0);
    expect(chestMesh.count).toBe(2);
    expect(readInstanceMatrix(chestMesh, 0).elements).toEqual(hiddenMatrix.elements);
    expect(readInstanceMatrix(chestMesh, 1).elements).toEqual(hiddenMatrix.elements);

    model.setMatrixAt(0, visibleMatrix);
    model.setCount(1);

    expect(model.getCount()).toBe(1);
    expect(chestMesh.count).toBe(2);
    expect(readInstanceMatrix(chestMesh, 0).elements).toEqual(visibleMatrix.elements);
    expect(readInstanceMatrix(chestMesh, 1).elements).toEqual(hiddenMatrix.elements);
    expect(model.getMatricesAndCount().count).toBe(1);
  });
});
