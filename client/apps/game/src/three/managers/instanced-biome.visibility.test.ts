import { describe, expect, it, vi } from "vitest";
import {
  Box3,
  BoxGeometry,
  Group,
  InstancedBufferAttribute,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Sphere,
  Vector3,
} from "three";

vi.mock("@/three/constants", () => ({
  PREVIEW_BUILD_COLOR_INVALID: 0xff00ff,
}));

vi.mock("@/three/managers/instanced-model", () => ({
  LAND_NAME: "LAND",
}));

vi.mock("@/ui/config", () => ({}));

import InstancedBiome from "./instanced-biome";

function createBiomeModel(name: string): InstancedBiome {
  const scene = new Group();
  scene.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));

  const gltf = {
    scene,
    animations: [],
  };

  return new InstancedBiome(gltf, 4, false, name);
}

function createGroupedBiomeModel(): InstancedBiome {
  const scene = new Group();
  const geometry = new BoxGeometry(1, 1, 1);
  const materials = geometry.groups.map((_, index) => {
    const material = new MeshStandardMaterial({ transparent: index === 0 });
    material.name = index === 0 ? "forest_opacity" : `terrain_${index}`;
    return material;
  });
  scene.add(new Mesh(geometry, materials));
  return new InstancedBiome({ scene, animations: [] }, 8, false, "TemperateDeciduousForest");
}

function createNamedBiomeModel(biomeName: string, meshName: string): InstancedBiome {
  const scene = new Group();
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
  mesh.name = meshName;
  scene.add(mesh);
  return new InstancedBiome({ scene, animations: [] }, 1, false, biomeName);
}

describe("InstancedBiome visibility", () => {
  it("restores mesh visibility when instance count grows from zero", () => {
    const biomeModel = createBiomeModel("Grassland");

    biomeModel.setCount(0);
    biomeModel.updateMeshVisibility();
    expect(biomeModel.instancedMeshes.every((mesh) => mesh.visible === false)).toBe(true);

    biomeModel.setCount(1);

    expect(biomeModel.instancedMeshes.every((mesh) => mesh.visible === true)).toBe(true);
  });

  it("applies authoritative world bounds to instanced mesh culling bounds", () => {
    const biomeModel = createBiomeModel("Grassland");
    const bounds = {
      box: new Box3(new Vector3(-25, -5, -25), new Vector3(25, 10, 25)),
      sphere: new Sphere(new Vector3(1, 2, 3), 35),
    };

    biomeModel.setWorldBounds(bounds);

    const mesh = biomeModel.instancedMeshes[0];
    expect(mesh.frustumCulled).toBe(true);
    expect(mesh.boundingSphere?.center.toArray()).toEqual([1, 2, 3]);
    expect(mesh.boundingSphere?.radius).toBe(35);
    expect(mesh.boundingBox?.min.toArray()).toEqual([-25, -5, -25]);
    expect(mesh.boundingBox?.max.toArray()).toEqual([25, 10, 25]);
  });

  it("thins only decorative geometry at far view and restores the exact full matrices", () => {
    const biomeModel = createGroupedBiomeModel();
    const source = new Float32Array(8 * 16);
    for (let index = 0; index < 8; index += 1) {
      source.set(new Matrix4().makeTranslation(index, 0, index).elements, index * 16);
    }
    biomeModel.setMatricesAndCount(new InstancedBufferAttribute(source, 16), 8);

    const detailMeshes = biomeModel.instancedMeshes.filter((mesh) => mesh.userData.isFarBiomeDetail === true);
    const terrainMeshes = biomeModel.instancedMeshes.filter((mesh) => mesh.userData.isFarBiomeDetail !== true);
    expect(detailMeshes).toHaveLength(1);
    expect(detailMeshes[0].count).toBe(8);

    biomeModel.setFarDetailEnabled(true);

    expect(detailMeshes[0].count).toBe(2);
    expect(terrainMeshes.every((mesh) => mesh.count === 8)).toBe(true);

    biomeModel.setFarDetailEnabled(false);

    expect(detailMeshes[0].count).toBe(8);
    expect(Array.from((detailMeshes[0].instanceMatrix.array as Float32Array).subarray(0, source.length))).toEqual(
      Array.from(source),
    );
  });

  it("configures land and outline render state before exact material pooling", () => {
    const firstLand = createNamedBiomeModel("Grassland", "LAND");
    const secondLand = createNamedBiomeModel("Grassland", "LAND");
    const firstOutline = createNamedBiomeModel("Outline", "outline");
    const secondOutline = createNamedBiomeModel("Outline", "outline");

    const firstLandMaterial = firstLand.instancedMeshes[0].material as MeshStandardMaterial;
    const secondLandMaterial = secondLand.instancedMeshes[0].material as MeshStandardMaterial;
    const firstOutlineMaterial = firstOutline.instancedMeshes[0].material as MeshStandardMaterial;
    const secondOutlineMaterial = secondOutline.instancedMeshes[0].material as MeshStandardMaterial;

    expect(firstLandMaterial).toBe(secondLandMaterial);
    expect(firstLandMaterial.vertexColors).toBe(true);
    expect(firstOutlineMaterial).toBe(secondOutlineMaterial);
    expect(firstOutlineMaterial.transparent).toBe(true);
    expect(firstOutlineMaterial.opacity).toBe(0.075);

    firstLand.dispose();
    secondLand.dispose();
    firstOutline.dispose();
    secondOutline.dispose();
  });
});
