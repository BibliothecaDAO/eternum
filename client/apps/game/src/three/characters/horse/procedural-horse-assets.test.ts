import { Bone, BoxGeometry, Group, MeshStandardMaterial, Skeleton, SkinnedMesh } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";

import { ProceduralHorseLibrary, type LoadedProceduralHorseAssetTemplate } from "./procedural-horse-assets";

describe("procedural horse assets", () => {
  it("resolves appearance metadata and isolates actor pose resources", () => {
    const template = createHorseTemplate();
    const library = new ProceduralHorseLibrary([template.asset]);
    const first = library.instantiate("quaternius", 1);
    const second = library.instantiate("quaternius", 3);
    const firstMesh = requireSkinnedMesh(first.gltf.scene);
    const secondMesh = requireSkinnedMesh(second.gltf.scene);

    expect(first.appearanceLabel).toBe("Quaternius Animated Animal");
    expect(first.id).toBe("quaternius-horse");
    expect(first.adapter.id).toBe("quaternius-horse");
    expect(first.scale).toBe(0.52);
    expect(firstMesh.geometry).toBe(template.mesh.geometry);
    expect(secondMesh.geometry).toBe(template.mesh.geometry);
    expect(firstMesh.material).not.toBe(secondMesh.material);
    expect(firstMesh.skeleton).not.toBe(secondMesh.skeleton);

    firstMesh.skeleton.dispose();
    secondMesh.skeleton.dispose();
    library.dispose();
  });

  it("rejects duplicate assets, adapter mismatches, and late actor creation", () => {
    const template = createHorseTemplate();
    expect(() => new ProceduralHorseLibrary([template.asset, template.asset])).toThrow("asset ids must be unique");

    const mismatched = {
      ...template.asset,
      adapterId: "missing-adapter" as LoadedProceduralHorseAssetTemplate["adapterId"],
    };
    const mismatchedLibrary = new ProceduralHorseLibrary([mismatched]);
    expect(() => mismatchedLibrary.instantiate("quaternius", 1)).toThrow("expects quaternius-horse");

    const invalidScaleLibrary = new ProceduralHorseLibrary([{ ...template.asset, scale: 0 }]);
    expect(() => invalidScaleLibrary.instantiate("quaternius", 1)).toThrow("invalid scene scale");

    const library = new ProceduralHorseLibrary([template.asset]);
    const geometryDispose = vi.spyOn(template.mesh.geometry, "dispose");
    library.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(() => library.instantiate("quaternius", 1)).toThrow("disposed procedural horse library");
  });
});

function createHorseTemplate(): { asset: LoadedProceduralHorseAssetTemplate; mesh: SkinnedMesh } {
  const root = new Bone();
  root.name = "Body";
  const child = new Bone();
  child.name = "Back";
  root.add(child);
  const skeleton = new Skeleton([root, child]);
  const mesh = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial());
  mesh.add(root);
  mesh.bind(skeleton);
  const scene = new Group();
  scene.add(mesh);
  const gltf = { animations: [], scene, scenes: [scene] } as unknown as GLTF;
  return {
    asset: {
      adapterId: "quaternius-horse",
      gltf,
      id: "quaternius-horse",
      label: "Test horse",
      scale: 0.52,
      url: "/test-horse.glb",
    },
    mesh,
  };
}

function requireSkinnedMesh(scene: Group): SkinnedMesh {
  let result: SkinnedMesh | undefined;
  scene.traverse((object) => {
    if (!result && object instanceof SkinnedMesh) result = object;
  });
  if (!result) throw new Error("Expected skinned mesh");
  return result;
}
