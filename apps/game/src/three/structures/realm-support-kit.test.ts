import { Box3, Mesh } from "three";
import { describe, expect, it } from "vitest";
import { isProcgenMasonryMaterial } from "./procgen-masonry-material";
import { realmSupportLabEntries, REALM_SUPPORT_PATHS, resolveProceduralRealmSupportKit } from "./realm-support-kit";

const HEX_APOTHEM = Math.sqrt(3) / 2;

function insideUnitHex(x: number, z: number): boolean {
  return Math.abs(x) <= HEX_APOTHEM + 1e-3 && Math.abs(x) + Math.sqrt(3) * Math.abs(z) <= Math.sqrt(3) + 1e-3;
}

describe("realm-support-kit", () => {
  it("resolves all 8 procedural realm support building paths and rejects GLBs", () => {
    const entries = Object.entries(REALM_SUPPORT_PATHS);
    expect(entries).toHaveLength(8);
    expect(realmSupportLabEntries().map((entry) => entry.id)).toEqual(entries.map(([id]) => id));
    for (const [id, path] of entries) {
      const gltf = resolveProceduralRealmSupportKit(path);
      expect(gltf).not.toBeNull();
      expect(gltf?.scene.name).toBe(`realm-support-${id}`);
      expect(gltf?.animations).toEqual([]);
      gltf?.scene.traverse((obj) => {
        if (obj instanceof Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    expect(resolveProceduralRealmSupportKit("/models/frontier/buildings/storeroom.glb")).toBeNull();
    expect(resolveProceduralRealmSupportKit("/models/frontier/painted/hearth.glb")).toBeNull();
    expect(resolveProceduralRealmSupportKit("procedural:realm-support:unknown")).toBeNull();
  });

  it("builds all 8 buildings inside the unit pointy hex with grounded bases, finite normals, 1-2 draws, and zero textures", () => {
    for (const [id, path] of Object.entries(REALM_SUPPORT_PATHS)) {
      const gltf = resolveProceduralRealmSupportKit(path)!;
      const meshes: Mesh[] = [];
      let triangles = 0;

      gltf.scene.traverse((obj) => {
        if (!(obj instanceof Mesh)) return;
        meshes.push(obj);
        const pos = obj.geometry.getAttribute("position");
        const norm = obj.geometry.getAttribute("normal");
        expect(pos.count, `${id}:${obj.name} positions`).toBeGreaterThan(0);
        expect(norm.count, `${id}:${obj.name} normals`).toBe(pos.count);
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          const z = pos.getZ(i);
          expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
          expect(insideUnitHex(x, z), `${id}:${obj.name} (${x.toFixed(3)}, ${z.toFixed(3)}) outside hex`).toBe(true);
          expect(Number.isFinite(norm.getX(i)) && Number.isFinite(norm.getY(i)) && Number.isFinite(norm.getZ(i))).toBe(
            true,
          );
        }
        const index = obj.geometry.index;
        triangles += index ? index.count / 3 : pos.count / 3;
        const material = obj.material as Record<string, unknown>;
        for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "bumpMap", "aoMap"]) {
          expect(material[key], `${id}:${obj.name} ${key}`).toBeFalsy();
        }
        expect(material.flatShading, `${id}:${obj.name} flatShading`).toBe(false);
      });

      expect(meshes.length, `${id} draw count`).toBeGreaterThanOrEqual(1);
      expect(meshes.length, `${id} draw count`).toBeLessThanOrEqual(2);
      const firstMaterial = meshes[0]!.material;
      expect(
        isProcgenMasonryMaterial(Array.isArray(firstMaterial) ? firstMaterial[0] : firstMaterial),
        `${id} masonry`,
      ).toBe(true);
      expect(triangles, `${id} tris`).toBeGreaterThan(150);
      expect(triangles, `${id} tris`).toBeLessThan(3500);

      const bounds = new Box3().setFromObject(gltf.scene);
      expect(bounds.min.y, `${id} grounded min.y`).toBeGreaterThanOrEqual(-0.03);
      expect(bounds.min.y, `${id} grounded min.y`).toBeLessThanOrEqual(0.02);
      expect(bounds.max.y, `${id} height`).toBeGreaterThan(0.5);
      expect(bounds.max.y, `${id} height`).toBeLessThan(1.55);

      for (const mesh of meshes) {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
        else mesh.material.dispose();
      }
    }
  });
});
