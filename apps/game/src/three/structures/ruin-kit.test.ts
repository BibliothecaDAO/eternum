import { Box3, type BufferAttribute, InstancedMesh, type Material, Mesh } from "three";
import { describe, expect, it } from "vitest";
import {
  FALLEN_REALM_MODEL_PATHS,
  FALLEN_REALM_RUIN_PATH,
  FALLEN_REALM_VARIANT_MODEL_INDICES,
  SITE_LANDMARK_MODEL_INDEX,
  ruinVariantModelIndex,
} from "./frontier-beast";
import { FrontierModel, frontierModelKind } from "./frontier-model";
import { createProcgenMasonryMaterial, isProcgenMasonryMaterial } from "./procgen-masonry-material";
import {
  RUIN_KIT_PATHS,
  RUIN_VARIANTS,
  RUIN_VARIANT_COUNT,
  createRuinKit,
  isRuinKitPath,
  parseRuinKitPath,
  resolveProceduralRuinKit,
  ruinKitPath,
  ruinVariantForHex,
} from "./ruin-kit";

const HEX_APOTHEM = Math.sqrt(3) / 2;

function disposeKit(kit: ReturnType<typeof createRuinKit>): void {
  kit.scene.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
    else child.material.dispose();
  });
}

describe("procedural Fallen Realm ruin kit", () => {
  it("parses and resolves every seeded ruin variant path and rejects invalid paths", () => {
    expect(RUIN_KIT_PATHS).toHaveLength(RUIN_VARIANT_COUNT);
    expect(FALLEN_REALM_RUIN_PATH).toBe(ruinKitPath(0));
    for (const variant of RUIN_VARIANTS) {
      const path = ruinKitPath(variant);
      expect(isRuinKitPath(path)).toBe(true);
      expect(parseRuinKitPath(path)).toBe(variant);
      expect(FALLEN_REALM_MODEL_PATHS[ruinVariantModelIndex(variant)]).toBe(path);
      expect(frontierModelKind(path)).toBe("ruin");
    }
    expect(ruinVariantModelIndex(0)).toBe(SITE_LANDMARK_MODEL_INDEX);
    expect(FALLEN_REALM_VARIANT_MODEL_INDICES).toHaveLength(RUIN_VARIANT_COUNT);
    expect(parseRuinKitPath("procedural:ruin:99")).toBeNull();
    expect(parseRuinKitPath("procedural:ruin:-1")).toBeNull();
    expect(parseRuinKitPath("procedural:ruin:0:extra")).toBeNull();
    expect(parseRuinKitPath("/models/outposts/ruin.glb")).toBeNull();
    expect(isRuinKitPath("procedural:hyperstructure")).toBe(false);
    expect(resolveProceduralRuinKit("procedural:ruin:99")).toBeNull();
  });

  it("assigns deterministic per-hex ruin variants covering every variant across nearby tiles", () => {
    const seen = new Set<number>();
    for (let col = -8; col <= 8; col++) {
      for (let row = -8; row <= 8; row++) {
        const first = ruinVariantForHex(col, row);
        const second = ruinVariantForHex(col, row);
        expect(first).toBe(second);
        expect(first).toBeGreaterThanOrEqual(0);
        expect(first).toBeLessThan(RUIN_VARIANT_COUNT);
        seen.add(first);
      }
    }
    expect(seen.size).toBe(RUIN_VARIANT_COUNT);
  });

  it("builds each variant in one masonry draw call sharing ProcgenMasonryNodeMaterial inside the unit hex with an open beast court", () => {
    const referenceMaterial = createProcgenMasonryMaterial();
    const triangleCounts: number[] = [];

    for (const variant of RUIN_VARIANTS) {
      const kit = resolveProceduralRuinKit(ruinKitPath(variant));
      expect(kit).not.toBeNull();
      const meshes: Mesh[] = [];
      kit!.scene.traverse((child) => {
        if (child instanceof Mesh) meshes.push(child);
      });
      expect(meshes).toHaveLength(1);
      const mesh = meshes[0]!;
      const material = mesh.material as ReturnType<typeof createProcgenMasonryMaterial>;
      expect(isProcgenMasonryMaterial(material)).toBe(true);
      expect(material.customProgramCacheKey()).toBe(referenceMaterial.customProgramCacheKey());
      expect(material.map).toBeNull();
      expect(material.normalMap).toBeNull();

      const index = mesh.geometry.getIndex();
      const position = mesh.geometry.getAttribute("position") as BufferAttribute;
      const triangles = (index ? index.count : position.count) / 3;
      expect(triangles).toBeGreaterThan(800);
      expect(triangles).toBeLessThan(2500);
      triangleCounts.push(triangles);

      const bounds = new Box3().setFromBufferAttribute(position);
      expect(bounds.min.y).toBeLessThanOrEqual(0);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.031);
      expect(bounds.max.y).toBeGreaterThan(0.75);
      expect(bounds.max.y).toBeLessThan(1.12);

      let maxApothem = 0;
      let minWallRadius = Infinity;
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        for (let side = 0; side < 3; side++) {
          maxApothem = Math.max(
            maxApothem,
            Math.abs(x * Math.cos((side * Math.PI) / 3) + z * Math.sin((side * Math.PI) / 3)),
          );
        }
        if (y > 0.003) {
          minWallRadius = Math.min(minWallRadius, Math.hypot(x, z));
        }
      }
      expect(maxApothem).toBeLessThanOrEqual(HEX_APOTHEM);
      expect(minWallRadius).toBeGreaterThan(0.7);

      const frontierModel = new FrontierModel(kit!, 4, "ruin");
      expect(frontierModel.instancedMeshes).toHaveLength(1);
      expect(isProcgenMasonryMaterial(frontierModel.instancedMeshes[0]!.material as Material)).toBe(true);
      const mist = frontierModel.group.getObjectByName("Ruin ground mist") as InstancedMesh;
      expect(mist).toBeInstanceOf(InstancedMesh);
      frontierModel.setCount(3);
      expect(mist.count).toBe(3);
      frontierModel.dispose();
      disposeKit(kit!);
    }

    expect(new Set(triangleCounts).size).toBeGreaterThan(1);
    referenceMaterial.dispose();
  });
});
