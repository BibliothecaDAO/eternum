import { Mesh, SkinnedMesh, type BufferGeometry, type Group, type Material, type Skeleton, type Texture } from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

import { collectMaterialTextures } from "../utils/material-textures";

/** Clone pose state and materials while retaining immutable geometry/textures. */
export function instantiateSkinnedScene(template: Group): Group {
  const scene = cloneSkeleton(template) as Group;
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone();
  });
  return scene;
}

/** Dispose a decoded template and every GPU resource it uniquely owns. */
export function disposeSkinnedSceneTemplates(scenes: readonly Group[]): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const skeletons = new Set<Skeleton>();
  const textures = new Set<Texture>();

  scenes.forEach((scene) => {
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      geometries.add(object.geometry);
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
      meshMaterials.forEach((material) => {
        materials.add(material);
        collectMaterialTextures(material, textures);
      });
      if (object instanceof SkinnedMesh) skeletons.add(object.skeleton);
    });
  });

  skeletons.forEach((skeleton) => skeleton.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}
