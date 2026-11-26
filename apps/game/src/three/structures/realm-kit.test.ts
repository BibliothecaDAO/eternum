import { REALM_SKIN_FAMILIES, SEASON_ONE_DRAWN_LEVELS, wornRealmSkinFamily } from "@bibliothecadao/eternum";
import { aspects, BuildingType, BUILDINGS_CENTER, RealmLevels, StructureType } from "@bibliothecadao/types";
import { Box3, Mesh, Triangle, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { isRealmModelPath, isSettlementModelPath } from "../constants/scene-constants";
import { wornRealmSkin } from "../cosmetics/realm-skins";
import { resolveBuildingModelSelection } from "../scenes/hexception-building-model";
import { requireFlagAnchors } from "./flag-anchors";
import { withFlagCloth } from "./flag-cloth";
import { REALM_ASSETS, realmModelIndex } from "./realm-design";
import {
  SEASON_ONE_REALM_KIT_LEVELS,
  createSeasonOneRealmKit,
  isSeasonOneRealmKitPath,
  parseSeasonOneRealmKitPath,
  resolveSeasonOneRealmKit,
  seasonOneRealmKitPath,
} from "./realm-kit";
import { resolveStructureRotationY } from "./structure-orientation";

const MAX_SETTLEMENT_TRIANGLES = 8000;

function countTriangles(mesh: Mesh): number {
  const index = mesh.geometry.getIndex();
  const count = index ? index.count : mesh.geometry.getAttribute("position").count;
  return count / 3;
}

describe("Season 1 procedural Aspect Settlement kit", () => {
  it("builds a grounded, floorless, hex-fit, bounded-budget Settlement with 1:2 wall banners for every catalog Aspect", () => {
    const signatures = new Set<string>();
    const triangle = new Triangle();
    const normal = new Vector3();

    for (const { id: aspect } of aspects) {
      const path = seasonOneRealmKitPath(aspect, 0);
      expect(isSeasonOneRealmKitPath(path)).toBe(true);
      expect(parseSeasonOneRealmKitPath(path)).toEqual({ aspect, level: 0 });
      expect(isRealmModelPath(path)).toBe(true);
      expect(isSettlementModelPath(path)).toBe(true);
      expect(resolveStructureRotationY([path], 1.2)).toBe(0);

      const gltf = resolveSeasonOneRealmKit(path);
      expect(gltf).not.toBeNull();

      const meshes: Mesh[] = [];
      let totalTriangles = 0;
      const bounds = new Box3();

      gltf!.scene.traverse((node) => {
        if (node instanceof Mesh) {
          meshes.push(node);
          expect(node.scale.x).toBe(1);
          expect(node.scale.y).toBe(1);
          expect(node.scale.z).toBe(1);
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
        }
      });

      expect(meshes.length).toBeGreaterThanOrEqual(2);
      expect(meshes.length).toBeLessThanOrEqual(3);
      expect(totalTriangles).toBeGreaterThan(200);
      expect(totalTriangles).toBeLessThanOrEqual(MAX_SETTLEMENT_TRIANGLES);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.002);
      expect(bounds.min.y).toBeLessThanOrEqual(0.02);
      expect(bounds.max.y).toBeGreaterThanOrEqual(0.75);
      expect(bounds.max.y).toBeLessThanOrEqual(1.05);
      expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))).toBeLessThanOrEqual(0.9);
      expect(Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z))).toBeLessThanOrEqual(0.9);

      const anchors = requireFlagAnchors(gltf!.scene.userData.flagAnchors, path);
      expect(anchors.length).toBe(2);
      for (const anchor of anchors) {
        expect(anchor.facing).toBe(0);
        expect(anchor.top[1] - anchor.width * 2).toBeGreaterThan(0.02);
      }

      withFlagCloth(gltf!);
      const cloth = gltf!.scene.getObjectByName("Realm banner cloth");
      expect(cloth).toBeInstanceOf(Mesh);
      expect(cloth?.userData.orderCloth).toBe("banner");

      const firstColor = Array.from((meshes[0]!.geometry.getAttribute("color").array as Float32Array).slice(0, 12))
        .map((value) => value.toFixed(3))
        .join(",");
      signatures.add(`${totalTriangles}:${firstColor}`);

      gltf!.scene.traverse((node) => {
        if (node instanceof Mesh) node.geometry.dispose();
      });
    }

    expect(signatures.size).toBe(aspects.length);
  });

  it("rejects malformed or unsupported procedural realm kit paths", () => {
    expect(parseSeasonOneRealmKitPath("procedural:hyperstructure")).toBeNull();
    expect(parseSeasonOneRealmKitPath("procedural:season-1-realm:99:0")).toBeNull();
    expect(parseSeasonOneRealmKitPath("procedural:season-1-realm:1:3")).toBeNull();
    expect(parseSeasonOneRealmKitPath("procedural:season-1-realm:1:0:extra")).toBeNull();
    expect(resolveSeasonOneRealmKit("procedural:season-1-realm:99:0")).toBeNull();
    const direct = createSeasonOneRealmKit(1, 0);
    expect(direct.scene.children.length).toBeGreaterThanOrEqual(2);
    direct.scene.traverse((node) => {
      if (node instanceof Mesh) node.geometry.dispose();
    });
  });

  it("agrees across Cosmetics page, world map, and realm view for every Seal, Aspect, Wonder, equipped skin, and level", () => {
    expect(SEASON_ONE_REALM_KIT_LEVELS).toEqual(SEASON_ONE_DRAWN_LEVELS);
    const keepBuilding = {
      category: BuildingType.ResourceLabor,
      col: BUILDINGS_CENTER[0],
      row: BUILDINGS_CENTER[1],
      structureType: StructureType.Realm,
    };

    for (const sealHeld of [false, true]) {
      for (const { id: aspect } of aspects) {
        for (const hasWonder of [false, true]) {
          for (const equipped of Object.values(REALM_SKIN_FAMILIES)) {
            for (const level of [RealmLevels.Settlement, RealmLevels.City, RealmLevels.Kingdom, RealmLevels.Empire]) {
              const wornFamily = wornRealmSkinFamily({ sealHeld, aspect, hasWonder }, equipped, level);
              const cosmeticsSkin = wornRealmSkin({ sealHeld, aspect, hasWonder, equipped, level });
              const showsWonder = wornFamily === REALM_SKIN_FAMILIES.WONDER_REALM_SKIN;
              const mapIndex = realmModelIndex(level, showsWonder, 1003, aspect, wornFamily);
              const mapAsset = REALM_ASSETS[mapIndex];
              const hexSelection = resolveBuildingModelSelection(keepBuilding, {
                stage: level,
                structureId: 1003,
                mainStructureType: StructureType.Realm,
                wonder: showsWonder,
                aspect,
                frontier: true,
                realmSkin: wornFamily,
              });

              const expectSeasonOne = wornFamily === REALM_SKIN_FAMILIES.SEASON_ONE_REALM_SKIN;
              expect(cosmeticsSkin.family === "season-1").toBe(expectSeasonOne);
              expect(mapAsset.skin === "season-1").toBe(expectSeasonOne);
              if (expectSeasonOne) {
                expect(mapAsset.aspect).toBe(aspect);
                expect(mapAsset.level).toBe(level);
                expect(hexSelection.tierPath).toBe(seasonOneRealmKitPath(aspect, 0));
              } else if (showsWonder) {
                expect(mapAsset.wonder).toBe(true);
                expect(hexSelection.tierPath).toBe(mapAsset.path);
              } else {
                expect(mapIndex).toBe(level);
                expect(hexSelection.tierPath).toBeUndefined();
              }
            }
          }
        }
      }
    }
  });
});
