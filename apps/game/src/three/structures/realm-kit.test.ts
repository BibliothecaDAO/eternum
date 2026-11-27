import { REALM_SKIN_FAMILIES, wornRealmSkinFamily } from "@bibliothecadao/eternum";
import {
  aspectName,
  aspects,
  BuildingType,
  BUILDINGS_CENTER,
  rankName,
  RealmLevels,
  StructureType,
} from "@bibliothecadao/types";
import { Box3, Mesh, Triangle, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { isRealmModelPath, isSettlementModelPath } from "../constants/scene-constants";
import { REALM_RANKS, wornRealmSkin } from "../cosmetics/realm-skins";
import { resolveBuildingModelSelection } from "../scenes/hexception-building-model";
import { requireFlagAnchors } from "./flag-anchors";
import { withFlagCloth } from "./flag-cloth";
import { REALM_ASSETS, SEASON_ONE_REALM_ASSETS, realmModelIndex } from "./realm-design";
import {
  SEASON_ONE_REALM_KIT_LEVELS,
  createSeasonOneRealmKit,
  isSeasonOneRealmKitPath,
  parseSeasonOneRealmKitPath,
  resolveSeasonOneRealmKit,
  seasonOneRealmKitPath,
} from "./realm-kit";
import { resolveStructureRotationY } from "./structure-orientation";

const MAX_TRIANGLES_BY_LEVEL = {
  0: 8000,
  1: 12000,
  2: 16000,
  3: 20000,
} as const satisfies Record<RealmLevels, number>;

const HEIGHT_BAND_BY_LEVEL = {
  0: { min: 0.65, max: 0.85 },
  1: { min: 1.05, max: 1.32 },
  2: { min: 1.8, max: 2.25 },
  3: { min: 2.65, max: 3.15 },
} as const satisfies Record<RealmLevels, { min: number; max: number }>;

const MAX_HEIGHT_TO_WIDTH_BY_LEVEL = {
  0: 0.5,
  1: 0.78,
  2: 1.32,
  3: 1.8,
} as const satisfies Record<RealmLevels, number>;

function countTriangles(mesh: Mesh): number {
  const index = mesh.geometry.getIndex();
  const count = index ? index.count : mesh.geometry.getAttribute("position").count;
  return count / 3;
}

describe("Season 1 procedural Aspect Realm kit", () => {
  it("builds a grounded, floorless, hex-fit, bounded-budget kit with 1:2 wall banners and clear height staircase for every drawn rank and catalog Aspect", () => {
    const triangle = new Triangle();
    const normal = new Vector3();
    const heightsByAspect = new Map<number, number[]>();

    for (const level of SEASON_ONE_REALM_KIT_LEVELS) {
      const signatures = new Set<string>();
      const heightBand = HEIGHT_BAND_BY_LEVEL[level];
      const maxTriangles = MAX_TRIANGLES_BY_LEVEL[level];

      for (const { id: aspect } of aspects) {
        const path = seasonOneRealmKitPath(aspect, level);
        expect(isSeasonOneRealmKitPath(path)).toBe(true);
        expect(parseSeasonOneRealmKitPath(path)).toEqual({ aspect, level });
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
        expect(totalTriangles).toBeLessThanOrEqual(maxTriangles);
        expect(bounds.min.y).toBeGreaterThanOrEqual(-0.002);
        expect(bounds.min.y).toBeLessThanOrEqual(0.02);
        expect(bounds.max.y).toBeGreaterThanOrEqual(heightBand.min);
        expect(bounds.max.y).toBeLessThanOrEqual(heightBand.max);
        const width = bounds.max.x - bounds.min.x;
        expect(bounds.max.y / width, `${path} H/W`).toBeLessThanOrEqual(MAX_HEIGHT_TO_WIDTH_BY_LEVEL[level]);
        expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))).toBeLessThanOrEqual(0.9);
        expect(Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z))).toBeLessThanOrEqual(0.9);

        const rankHeights = heightsByAspect.get(aspect) ?? [];
        rankHeights.push(bounds.max.y);
        heightsByAspect.set(aspect, rankHeights);

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
    }

    for (const { id: aspect } of aspects) {
      const heights = heightsByAspect.get(aspect)!;
      expect(heights).toHaveLength(SEASON_ONE_REALM_KIT_LEVELS.length);
      for (let index = 1; index < heights.length; index++) {
        expect(heights[index]!).toBeGreaterThan(heights[index - 1]! + 0.2);
      }
    }
  });

  it("rejects malformed or unsupported procedural realm kit paths", () => {
    expect(parseSeasonOneRealmKitPath("procedural:hyperstructure")).toBeNull();
    expect(parseSeasonOneRealmKitPath("procedural:season-1-realm:99:0")).toBeNull();
    expect(parseSeasonOneRealmKitPath("procedural:season-1-realm:1:4")).toBeNull();
    expect(parseSeasonOneRealmKitPath("procedural:season-1-realm:1:0:extra")).toBeNull();
    expect(resolveSeasonOneRealmKit("procedural:season-1-realm:99:0")).toBeNull();
    for (const level of SEASON_ONE_REALM_KIT_LEVELS) {
      const direct = createSeasonOneRealmKit(1, level);
      expect(direct.scene.children.length).toBeGreaterThanOrEqual(2);
      direct.scene.traverse((node) => {
        if (node instanceof Mesh) node.geometry.dispose();
      });
    }
  });

  it("gives every Season 1 realm asset a unique label naming its Aspect and rank", () => {
    expect(SEASON_ONE_REALM_ASSETS).toHaveLength(aspects.length * SEASON_ONE_REALM_KIT_LEVELS.length);
    const labels = SEASON_ONE_REALM_ASSETS.map((asset) => asset.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const asset of SEASON_ONE_REALM_ASSETS) {
      expect(asset.label).toBe(`Season 1 · ${aspectName(asset.aspect!)} · ${rankName(asset.level)}`);
    }
  });

  it("agrees across Cosmetics page, world map, and realm view for every Seal, Aspect, Wonder, equipped skin, and level", () => {
    expect(SEASON_ONE_REALM_KIT_LEVELS).toEqual(REALM_RANKS);
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
            for (const level of SEASON_ONE_REALM_KIT_LEVELS) {
              const wornFamily = wornRealmSkinFamily({ sealHeld, aspect, hasWonder }, equipped);
              const cosmeticsSkin = wornRealmSkin({ sealHeld, aspect, hasWonder, equipped });
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
                expect(hexSelection.tierPath).toBe(seasonOneRealmKitPath(aspect, level));
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
