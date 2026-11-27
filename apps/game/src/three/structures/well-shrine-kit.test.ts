import { MAP_SITES } from "@/config/map-sites";
import { Box3, Mesh, type Material } from "three";
import { describe, expect, it } from "vitest";
import InstancedModel from "../managers/instanced-model";
import { isProcgenMasonryMaterial } from "./procgen-masonry-material";
import {
  SHRINE_SITE_MODEL_PATH,
  WELL_SHRINE_PATHS,
  WELL_SITE_MODEL_PATH,
  createShrineKit,
  createWellKit,
  resolveProceduralWellShrineKit,
} from "./well-shrine-kit";

const HEX_APOTHEM = Math.sqrt(3) / 2;

function expectInsideGroundedHex(scene: ReturnType<typeof createWellKit>["scene"], maxHeight: number) {
  const box = new Box3().setFromObject(scene);
  expect(box.min.y).toBeGreaterThanOrEqual(-0.005);
  expect(box.min.y).toBeLessThanOrEqual(0.005);
  expect(box.max.y).toBeGreaterThan(0.75);
  expect(box.max.y).toBeLessThanOrEqual(maxHeight);
  expect(Math.abs(box.min.x)).toBeLessThan(HEX_APOTHEM);
  expect(Math.abs(box.max.x)).toBeLessThan(HEX_APOTHEM);
  expect(Math.abs(box.min.z)).toBeLessThan(HEX_APOTHEM);
  expect(Math.abs(box.max.z)).toBeLessThan(HEX_APOTHEM);
  scene.traverse((node) => {
    if (node instanceof Mesh) {
      expect(node.scale.toArray()).toEqual([1, 1, 1]);
    }
  });
}

function disposeScene(scene: ReturnType<typeof createWellKit>["scene"]) {
  scene.traverse((node) => {
    if (node instanceof Mesh) {
      node.geometry.dispose();
      (node.material as Material).dispose();
    }
  });
}

describe("procedural Well & Shrine map site kits", () => {
  it("resolves every MAP_SITES kind through WELL_SHRINE_PATHS and rejects unknown paths", () => {
    for (const site of MAP_SITES) {
      const path = WELL_SHRINE_PATHS[site.kind];
      const kit = resolveProceduralWellShrineKit(path);
      expect(kit, site.kind).not.toBeNull();
      disposeScene(kit!.scene);
    }
    expect(resolveProceduralWellShrineKit("procedural:well-shrine:unknown")).toBeNull();
    expect(resolveProceduralWellShrineKit("/models/outposts/well.glb")).toBeNull();
  });

  it("builds a grounded, floorless 2-mesh Well kit with shared procgen masonry and animated TSL water", () => {
    const kit = createWellKit();
    expect(kit.animations).toEqual([]);
    expectInsideGroundedHex(kit.scene, 1.15);

    const meshes = kit.scene.children.filter((child): child is Mesh => child instanceof Mesh);
    expect(meshes.map((mesh) => mesh.name)).toEqual(["well:masonry", "well:water"]);

    const [masonry, water] = meshes;
    expect(isProcgenMasonryMaterial(masonry!.material as Material)).toBe(true);
    const waterMaterial = water!.material as Material & {
      isNodeMaterial?: boolean;
      normalNode?: unknown;
      colorNode?: unknown;
      emissiveNode?: unknown;
      map?: unknown;
      customProgramCacheKey?: () => string;
    };
    expect(waterMaterial.isNodeMaterial).toBe(true);
    expect(waterMaterial.map ?? null).toBeNull();
    expect(waterMaterial.normalNode).toBeTruthy();
    expect(waterMaterial.colorNode).toBeTruthy();
    expect(waterMaterial.emissiveNode).toBeTruthy();
    expect(waterMaterial.customProgramCacheKey?.()).toBe("eternum-procgen-well-water-v1");

    const instanced = new InstancedModel(kit, 8, false, "Well");
    expect(instanced.instancedMeshes).toHaveLength(2);
    expect(instanced.instancedMeshes[0]!.material).toBe(masonry!.material);
    expect(instanced.instancedMeshes[1]!.material).toBe(water!.material);
    instanced.dispose();
  });

  it("builds a grounded, floorless 2-mesh Shrine kit with shared procgen masonry and animated TSL emissive aura", () => {
    const kit = createShrineKit();
    expect(kit.animations).toEqual([]);
    expectInsideGroundedHex(kit.scene, 1.35);

    const meshes = kit.scene.children.filter((child): child is Mesh => child instanceof Mesh);
    expect(meshes.map((mesh) => mesh.name)).toEqual(["shrine:masonry", "shrine:aura"]);

    const [masonry, aura] = meshes;
    expect(isProcgenMasonryMaterial(masonry!.material as Material)).toBe(true);
    const auraMaterial = aura!.material as Material & {
      isNodeMaterial?: boolean;
      colorNode?: unknown;
      emissiveNode?: unknown;
      map?: unknown;
      customProgramCacheKey?: () => string;
    };
    expect(auraMaterial.isNodeMaterial).toBe(true);
    expect(auraMaterial.map ?? null).toBeNull();
    expect(auraMaterial.colorNode).toBeTruthy();
    expect(auraMaterial.emissiveNode).toBeTruthy();
    expect(auraMaterial.customProgramCacheKey?.()).toBe("eternum-procgen-shrine-aura-v1");

    const instanced = new InstancedModel(kit, 8, false, "Shrine");
    expect(instanced.instancedMeshes).toHaveLength(2);
    expect(instanced.instancedMeshes[0]!.material).toBe(masonry!.material);
    expect(instanced.instancedMeshes[1]!.material).toBe(aura!.material);
    instanced.dispose();
  });

  it("shares the exact same masonry program cache key across Well and Shrine", () => {
    const well = resolveProceduralWellShrineKit(WELL_SITE_MODEL_PATH)!;
    const shrine = resolveProceduralWellShrineKit(SHRINE_SITE_MODEL_PATH)!;
    const wellMat = (well.scene.children[0] as Mesh).material as Material & { customProgramCacheKey: () => string };
    const shrineMat = (shrine.scene.children[0] as Mesh).material as Material & { customProgramCacheKey: () => string };
    expect(wellMat.customProgramCacheKey()).toBe(shrineMat.customProgramCacheKey());
    disposeScene(well.scene);
    disposeScene(shrine.scene);
  });
});
