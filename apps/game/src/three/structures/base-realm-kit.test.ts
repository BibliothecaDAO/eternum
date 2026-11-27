import { RealmLevels } from "@bibliothecadao/types";
import { Box3, Mesh, Triangle, Vector3 } from "three";
import MeshStandardNodeMaterial from "three/src/materials/nodes/MeshStandardNodeMaterial.js";
import { describe, expect, it } from "vitest";
import { isRealmModelPath, isSettlementModelPath } from "../constants/scene-constants";
import InstancedModel from "../managers/instanced-model";
import {
  BASE_REALM_ASSETS,
  BASE_REALM_KIT_LEVELS,
  baseRealmKitPath,
  createBaseRealmKit,
  isBaseRealmKitPath,
  parseBaseRealmKitPath,
} from "./base-realm-kit";
import { requireFlagAnchors } from "./flag-anchors";
import { withFlagCloth } from "./flag-cloth";
import { isProcgenMasonryMaterial } from "./procgen-masonry-material";
import { REALM_ASSETS, realmModelIndex } from "./realm-design";
import { isProceduralRealmKitPath, resolveProceduralRealmKit } from "./realm-kit";
import { resolveStructureRotationY } from "./structure-orientation";

const MAX_TRIANGLES_BY_LEVEL = {
  [RealmLevels.Settlement]: 6500,
  [RealmLevels.City]: 8000,
  [RealmLevels.Kingdom]: 10000,
  [RealmLevels.Empire]: 14000,
} as const satisfies Record<RealmLevels, number>;

const HEIGHT_BAND_BY_LEVEL = {
  [RealmLevels.Settlement]: { min: 0.65, max: 0.85 },
  [RealmLevels.City]: { min: 1.15, max: 1.38 },
  [RealmLevels.Kingdom]: { min: 1.85, max: 2.15 },
  [RealmLevels.Empire]: { min: 2.7, max: 3.05 },
} as const satisfies Record<RealmLevels, { readonly min: number; readonly max: number }>;

function countTriangles(mesh: Mesh): number {
  const index = mesh.geometry.getIndex();
  const count = index ? index.count : mesh.geometry.getAttribute("position").count;
  return count / 3;
}

describe("Procedural Base Realm kit", () => {
  it("builds floorless, grounded, hex-fit, bounded-budget base realms with shared TSL materials and 1:2 wall banners for every rank", () => {
    const triangle = new Triangle();
    const normal = new Vector3();
    const heights: number[] = [];
    let totalBodyDraws = 0;

    expect(BASE_REALM_ASSETS).toHaveLength(BASE_REALM_KIT_LEVELS.length);

    for (const level of BASE_REALM_KIT_LEVELS) {
      const path = baseRealmKitPath(level);
      expect(isBaseRealmKitPath(path)).toBe(true);
      expect(isProceduralRealmKitPath(path)).toBe(true);
      expect(parseBaseRealmKitPath(path)).toBe(level);
      expect(REALM_ASSETS[realmModelIndex(level, false, 1003)]?.path).toBe(path);
      expect(isRealmModelPath(path)).toBe(true);
      expect(isSettlementModelPath(path)).toBe(true);
      expect(resolveStructureRotationY([path], 1.2)).toBe(0);

      const gltf = resolveProceduralRealmKit(path)!;
      expect(gltf).not.toBeNull();
      const meshes: Mesh[] = [];
      let totalTriangles = 0;
      const bounds = new Box3();

      gltf.scene.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        meshes.push(node);
        expect(node.scale.x).toBe(1);
        expect(node.scale.y).toBe(1);
        expect(node.scale.z).toBe(1);

        const material = Array.isArray(node.material) ? node.material[0]! : node.material;
        expect(material.flatShading).toBe(false);
        if (node.name.endsWith(":masonry")) {
          expect(isProcgenMasonryMaterial(material)).toBe(true);
        } else if (node.name.endsWith(":glow")) {
          expect(material).toBeInstanceOf(MeshStandardNodeMaterial);
        }

        const geometry = node.geometry;
        for (const attr of ["position", "normal", "uv", "color"]) {
          const buffer = geometry.getAttribute(attr);
          expect(buffer, `${path} ${node.name} ${attr}`).toBeDefined();
          expect(Array.from(buffer.array).every(Number.isFinite), `${path} ${node.name} ${attr}`).toBe(true);
        }
        const positions = geometry.getAttribute("position");
        const index = geometry.getIndex();
        const count = index?.count ?? positions.count;
        for (let face = 0; face < count; face += 3) {
          triangle.a.fromBufferAttribute(positions, index ? index.getX(face) : face);
          triangle.b.fromBufferAttribute(positions, index ? index.getX(face + 1) : face + 1);
          triangle.c.fromBufferAttribute(positions, index ? index.getX(face + 2) : face + 2);
          expect(triangle.getArea(), `${path} ${node.name} face ${face / 3}`).toBeGreaterThan(1e-12);
          expect(triangle.getNormal(normal).length(), `${path} ${node.name}`).toBeCloseTo(1, 5);
        }
        totalTriangles += countTriangles(node);
        geometry.computeBoundingBox();
        bounds.union(geometry.boundingBox!);
      });

      expect(meshes).toHaveLength(2);
      totalBodyDraws += meshes.length;
      expect(totalTriangles).toBeGreaterThan(400);
      expect(totalTriangles).toBeLessThanOrEqual(MAX_TRIANGLES_BY_LEVEL[level]);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.002);
      expect(bounds.min.y).toBeLessThanOrEqual(0.01);
      expect(bounds.max.y).toBeGreaterThanOrEqual(HEIGHT_BAND_BY_LEVEL[level].min);
      expect(bounds.max.y).toBeLessThanOrEqual(HEIGHT_BAND_BY_LEVEL[level].max);
      expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))).toBeLessThanOrEqual(0.9);
      expect(Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z))).toBeLessThanOrEqual(0.9);
      heights.push(bounds.max.y);

      const anchors = requireFlagAnchors(gltf.scene.userData.flagAnchors, path);
      expect(anchors).toHaveLength(2);
      for (const anchor of anchors) {
        expect(anchor.facing).toBe(0);
        expect(anchor.top[1] - anchor.width * 2).toBeGreaterThan(0.02);
      }

      withFlagCloth(gltf);
      const cloth = gltf.scene.getObjectByName("Realm banner cloth");
      expect(cloth).toBeInstanceOf(Mesh);
      expect(cloth?.userData.orderCloth).toBe("banner");

      gltf.scene.traverse((node) => {
        if (node instanceof Mesh) node.geometry.dispose();
      });
    }

    expect(totalBodyDraws).toBeLessThanOrEqual(8);
    for (let index = 1; index < heights.length; index++) {
      expect(heights[index]!).toBeGreaterThan(heights[index - 1]! + 0.35);
    }
  });

  it("rejects malformed or out-of-range base realm procedural paths", () => {
    expect(parseBaseRealmKitPath("procedural:season-1-realm:1:0")).toBeNull();
    expect(parseBaseRealmKitPath("procedural:base-realm:-1")).toBeNull();
    expect(parseBaseRealmKitPath("procedural:base-realm:4")).toBeNull();
    expect(parseBaseRealmKitPath("procedural:base-realm:0:extra")).toBeNull();
    expect(parseBaseRealmKitPath("procedural:base-realm:")).toBeNull();
    expect(isBaseRealmKitPath("/models/realms/settlement.glb")).toBe(false);
    expect(resolveProceduralRealmKit("procedural:base-realm:99")).toBeNull();
    const direct = createBaseRealmKit(RealmLevels.Settlement);
    expect(direct.scene.children).toHaveLength(2);
    const instanced = new InstancedModel(direct, 1, false, "Realm");
    expect(instanced.instancedMeshes).toHaveLength(2);
    instanced.dispose();
  });
});
