import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/three/constants", () => ({
  PREVIEW_BUILD_COLOR_INVALID: 0xff00ff,
}));

vi.mock("@/three/managers/instanced-model", () => ({
  LAND_NAME: "LAND",
}));

vi.mock("@/ui/config", () => ({}));

import InstancedBiome from "./instanced-biome";

const createSharedLandGltf = () => {
  const scene = new Group();
  const geometry = new BoxGeometry(1, 1, 1);
  const mesh = new Mesh(geometry, new MeshStandardMaterial());
  mesh.name = "LAND";
  scene.add(mesh);
  return { geometry, gltf: { animations: [], scene } };
};

describe("InstancedBiome land color ownership", () => {
  it("updates the color attribute captured at first draw and keeps unused slots neutral", () => {
    const { gltf } = createSharedLandGltf();
    const biome = new InstancedBiome(gltf, 4, false, "Grassland");
    const mesh = biome.instancedMeshes[0];

    // The nodes renderer retains this object when it builds the first render object.
    const firstDrawColorAttribute = mesh.instanceColor;
    expect(firstDrawColorAttribute).toBeDefined();
    expect(Array.from(firstDrawColorAttribute!.array)).toEqual(new Array(12).fill(1));

    const previousUploadVersion = firstDrawColorAttribute!.version;
    biome.setLandColors(new Float32Array([0.25, 0.5, 0.75, 0.9, 0.8, 0.7]), 2);

    expect(mesh.instanceColor).toBe(firstDrawColorAttribute);
    expect(Array.from(firstDrawColorAttribute!.array)).toEqual(
      Array.from(new Float32Array([0.25, 0.5, 0.75, 0.9, 0.8, 0.7, 1, 1, 1, 1, 1, 1])),
    );
    expect(firstDrawColorAttribute!.version).toBe(previousUploadVersion + 1);
  });

  it("owns colors per scene while retaining shared biome geometry", () => {
    const { geometry, gltf } = createSharedLandGltf();
    const worldmapBiome = new InstancedBiome(gltf, 2, false, "Grassland");
    const hexceptionBiome = new InstancedBiome(gltf, 2, false, "Grassland");
    const worldmapMesh = worldmapBiome.instancedMeshes[0];
    const hexceptionMesh = hexceptionBiome.instancedMeshes[0];

    expect(worldmapMesh.geometry).toBe(geometry);
    expect(hexceptionMesh.geometry).toBe(geometry);
    expect(geometry.getAttribute("instanceColor")).toBeUndefined();
    expect(worldmapMesh.instanceColor).not.toBe(hexceptionMesh.instanceColor);

    worldmapBiome.setLandColors(new Float32Array([0.1, 0.2, 0.3]), 1);

    expect(Array.from(worldmapMesh.instanceColor!.array).slice(0, 3)).toEqual([
      expect.closeTo(0.1),
      expect.closeTo(0.2),
      expect.closeTo(0.3),
    ]);
    expect(Array.from(hexceptionMesh.instanceColor!.array)).toEqual(new Array(6).fill(1));
  });

  it("fails loudly when terrain tint data targets a biome without a land mesh", () => {
    const scene = new Group();
    scene.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    const biome = new InstancedBiome({ animations: [], scene }, 1, false, "Grassland");

    expect(() => biome.setLandColors(new Float32Array([1, 1, 1]), 1)).toThrow(
      "Biome Grassland is missing its land mesh",
    );
  });
});
