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

  it("skips bounding sphere recomputation when fixed world bounds are applied", () => {
    const biomeModel = createBiomeModel("Grassland");
    const bounds = {
      box: new Box3(new Vector3(-4, -1, -4), new Vector3(4, 1, 4)),
      sphere: new Sphere(new Vector3(0, 0, 0), 6),
    };

    biomeModel.setWorldBounds(bounds);

    const computeSpies = biomeModel.instancedMeshes.map((mesh) => vi.spyOn(mesh, "computeBoundingSphere"));

    biomeModel.setCount(1);

    computeSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    biomeModel.instancedMeshes.forEach((mesh) => {
      expect(mesh.geometry.boundingSphere?.radius).toBe(bounds.sphere.radius);
      expect(mesh.geometry.boundingBox?.min.equals(bounds.box.min)).toBe(true);
      expect(mesh.geometry.boundingBox?.max.equals(bounds.box.max)).toBe(true);
    });
  });
});
