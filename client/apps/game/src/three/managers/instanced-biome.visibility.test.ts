import { describe, expect, it, vi } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";

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
});
