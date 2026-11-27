import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import type Node from "three/src/nodes/core/Node.js";
import { describe, expect, it } from "vitest";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";
import InstancedModel from "../managers/instanced-model";
import { createHyperstructureKit } from "./hyperstructure-kit";
import { HyperstructureModel } from "./hyperstructure-model";
import { createProcgenMasonryMaterial, isProcgenMasonryMaterial } from "./procgen-masonry-material";
import { createSeasonOneRealmKit } from "./realm-kit";

function collectPropertyNames(root: Node | null): string[] {
  const names: string[] = [];
  root?.traverse((node) => {
    const propertyNode = node as Node & { isPropertyNode?: boolean; name?: string | null };
    if (propertyNode.isPropertyNode && propertyNode.name) {
      names.push(propertyNode.name);
    }
  });
  return names;
}

describe("shared procedural masonry node material", () => {
  it("builds a textureless FrostedStandardNodeMaterial with a shared program cache key", () => {
    const first = createProcgenMasonryMaterial();
    const second = createProcgenMasonryMaterial();
    expect(first).toBeInstanceOf(FrostedStandardNodeMaterial);
    expect(isProcgenMasonryMaterial(first)).toBe(true);
    expect(isProcgenMasonryMaterial(new MeshStandardMaterial())).toBe(false);
    expect(first.vertexColors).toBe(true);
    expect(first.flatShading).toBe(false);
    expect(first.map).toBeNull();
    expect(first.bumpMap).toBeNull();
    expect(first.roughnessMap).toBeNull();
    expect(first.normalNode).not.toBeNull();
    expect(first.roughnessNode).not.toBeNull();
    expect(first.metalnessNode).not.toBeNull();
    expect(first.customProgramCacheKey()).toBe(second.customProgramCacheKey());
    first.dispose();
    second.dispose();
  });

  it("shares one procgenMetalMask property across roughness and metalness without re-reading diffuseColor", () => {
    const material = createProcgenMasonryMaterial();
    const roughnessProps = collectPropertyNames(material.roughnessNode);
    const metalnessProps = collectPropertyNames(material.metalnessNode);
    expect(roughnessProps).toContain("procgenMetalMask");
    expect(metalnessProps).toContain("procgenMetalMask");
    expect(roughnessProps).not.toContain("DiffuseColor");
    expect(metalnessProps).not.toContain("DiffuseColor");
    material.dispose();
  });

  it("is preserved directly by InstancedModel without MaterialPool flattening", () => {
    const scene = new Group();
    const material = createProcgenMasonryMaterial();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
    mesh.name = "masonry";
    scene.add(mesh);
    const model = new InstancedModel({ scene, animations: [] }, 2, false, "Realm");
    expect(model.instancedMeshes[0]!.material).toBe(material);
    expect(isProcgenMasonryMaterial(model.instancedMeshes[0]!.material as MeshStandardMaterial)).toBe(true);
    model.dispose();
  });

  it("is shared across both Season 1 realm kits and Hyperstructure masonry parts with zero grain DataTextures", () => {
    const realmKit = createSeasonOneRealmKit(1, 3);
    const realmMasonry = realmKit.scene.children[0] as Mesh;
    expect(isProcgenMasonryMaterial(realmMasonry.material as MeshStandardMaterial)).toBe(true);
    expect((realmMasonry.material as FrostedStandardNodeMaterial).map).toBeNull();

    const hsKit = createHyperstructureKit();
    const hsMasonry = hsKit.scene.children[0] as Mesh;
    expect(isProcgenMasonryMaterial(hsMasonry.material as MeshStandardMaterial)).toBe(true);
    expect((realmMasonry.material as FrostedStandardNodeMaterial).customProgramCacheKey()).toBe(
      (hsMasonry.material as FrostedStandardNodeMaterial).customProgramCacheKey(),
    );

    const hsModel = new HyperstructureModel(2);
    expect(isProcgenMasonryMaterial(hsModel.instancedMeshes[0]!.material as MeshStandardMaterial)).toBe(true);
    expect(
      hsModel.instancedMeshes.filter((mesh) => isProcgenMasonryMaterial(mesh.material as MeshStandardMaterial)).length,
    ).toBeGreaterThan(50);

    for (const child of realmKit.scene.children) {
      if (child instanceof Mesh) {
        child.geometry.dispose();
        (child.material as MeshStandardMaterial).dispose();
      }
    }
    for (const child of hsKit.scene.children) {
      if (child instanceof Mesh) child.geometry.dispose();
    }
    hsModel.dispose();
  });
});
