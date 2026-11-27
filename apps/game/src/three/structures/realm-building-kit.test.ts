import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Mesh, Vector3, type Material } from "three";
import { describe, expect, it } from "vitest";
import { FRONTIER_PAINTED_BUILDINGS } from "./frontier-painted-buildings";
import { isProceduralModelPath, resolveProceduralModel } from "./procedural-model-resolver";
import { isProcgenMasonryMaterial } from "./procgen-masonry-material";
import {
  REALM_BUILDING_FAMILIES,
  REALM_BUILDING_TIERS,
  createRealmBuildingKit,
  isRealmBuildingKitPath,
  parseRealmBuildingKitPath,
  realmBuildingKitPath,
  resolveRealmBuildingKit,
} from "./realm-building-kit";

const HEX_APOTHEM = Math.sqrt(3) / 2;
const PUBLIC_MODELS = new URL("../../../public/models/", import.meta.url);
const RETIRED_GLBS = [
  ...REALM_BUILDING_FAMILIES.flatMap((family) =>
    REALM_BUILDING_TIERS.map((tier) => `frontier/painted/${family}-${tier}.glb`),
  ),
  "frontier/buildings/farm-2.glb",
  "frontier/buildings/farm-3.glb",
  "frontier/buildings/barracks-2.glb",
  "frontier/buildings/barracks-3.glb",
];

describe("runtime procedural realm tiered building kit", () => {
  it("ships zero retired GLB files for Farm, Workshop, and Barracks tiers", () => {
    const remaining = RETIRED_GLBS.filter((rel) => existsSync(fileURLToPath(new URL(rel, PUBLIC_MODELS))));
    expect(remaining).toEqual([]);
  });

  it("parses and resolves every valid family and tier path while rejecting invalid ones", () => {
    for (const family of REALM_BUILDING_FAMILIES) {
      for (const tier of REALM_BUILDING_TIERS) {
        const path = realmBuildingKitPath(family, tier);
        expect(isRealmBuildingKitPath(path)).toBe(true);
        expect(isProceduralModelPath(path)).toBe(true);
        expect(parseRealmBuildingKitPath(path)).toEqual({ family, tier });
        const gltf = resolveProceduralModel(path);
        expect(gltf).not.toBeNull();
        disposeGltf(gltf!);
        const direct = resolveRealmBuildingKit(path);
        expect(direct).not.toBeNull();
        disposeGltf(direct!);
      }
    }
    expect(realmBuildingKitPath("farm", 0)).toBe("procedural:realm-building:farm:1");
    expect(realmBuildingKitPath("barracks", 9)).toBe("procedural:realm-building:barracks:5");
    expect(isRealmBuildingKitPath("/models/frontier/painted/farm-1.glb")).toBe(false);
    expect(resolveRealmBuildingKit("procedural:realm-building:farm:6")).toBeNull();
    expect(resolveRealmBuildingKit("procedural:realm-building:unknown:1")).toBeNull();
  });

  it.each(REALM_BUILDING_FAMILIES)(
    "builds %s tiers I to V inside the hex plot with monotonic height, finite normals, and 1 to 2 draws",
    (family) => {
      let previousHeight = 0;
      for (const tier of REALM_BUILDING_TIERS) {
        const gltf = createRealmBuildingKit(family, tier);
        const meshes: Mesh[] = [];
        gltf.scene.traverse((child) => {
          if (child instanceof Mesh) meshes.push(child);
        });

        expect(meshes.length).toBeGreaterThanOrEqual(1);
        expect(meshes.length).toBeLessThanOrEqual(2);
        expect(isProcgenMasonryMaterial(meshes[0].material as Material)).toBe(true);

        let totalTris = 0;
        let minY = Infinity;
        let maxY = -Infinity;
        let maxApothem = 0;
        const vertex = new Vector3();

        for (const mesh of meshes) {
          const material = mesh.material as Material & { flatShading?: boolean };
          expect(material.flatShading).toBe(false);
          for (const value of Object.values(material)) {
            expect((value as { isTexture?: boolean } | null)?.isTexture).not.toBe(true);
          }

          const geometry = mesh.geometry;
          const positions = geometry.getAttribute("position");
          const normals = geometry.getAttribute("normal");
          const index = geometry.getIndex();
          expect(positions.count).toBeGreaterThan(0);
          expect(normals.count).toBe(positions.count);

          totalTris += (index ? index.count : positions.count) / 3;

          for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i);
            expect(Number.isFinite(vertex.x)).toBe(true);
            expect(Number.isFinite(vertex.y)).toBe(true);
            expect(Number.isFinite(vertex.z)).toBe(true);
            minY = Math.min(minY, vertex.y);
            maxY = Math.max(maxY, vertex.y);
            const ax = Math.abs(vertex.x);
            const az = Math.abs(vertex.z);
            maxApothem = Math.max(maxApothem, ax, 0.5 * ax + HEX_APOTHEM * az);

            expect(Number.isFinite(normals.getX(i))).toBe(true);
            expect(Number.isFinite(normals.getY(i))).toBe(true);
            expect(Number.isFinite(normals.getZ(i))).toBe(true);
          }
        }

        const catalogueEntry = FRONTIER_PAINTED_BUILDINGS.find((entry) => entry.id === `${family}-${tier}`);
        expect(catalogueEntry).toBeDefined();
        expect(totalTris).toBeGreaterThan(400);
        expect(totalTris).toBeLessThanOrEqual(catalogueEntry!.architectureTriangles);
        expect(minY).toBeGreaterThanOrEqual(-0.001);
        expect(minY).toBeLessThan(0.02);
        expect(maxApothem).toBeLessThanOrEqual(HEX_APOTHEM);
        expect(maxY).toBeGreaterThan(previousHeight);
        previousHeight = maxY;

        disposeGltf(gltf);
      }
    },
  );
});

function disposeGltf(gltf: ReturnType<typeof createRealmBuildingKit>): void {
  gltf.scene.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    }
  });
}
