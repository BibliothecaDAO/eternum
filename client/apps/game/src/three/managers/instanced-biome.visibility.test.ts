import { describe, expect, it, vi } from "vitest";
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Sphere, Vector3 } from "three";

vi.mock("@/three/constants", () => ({
  PREVIEW_BUILD_COLOR_INVALID: 0xff00ff,
}));

vi.mock("@/three/managers/instanced-model", () => ({
  LAND_NAME: "LAND",
}));

vi.mock("@/ui/config", () => ({
  GRAPHICS_SETTING: "high",
  GraphicsSettings: {
    LOW: "low",
  },
}));

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
});
