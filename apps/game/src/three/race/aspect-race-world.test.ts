import { aspects } from "@bibliothecadao/types";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { resolveHyperstructureDesign } from "@/three/structures/hyperstructure-design";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import { prepareTerrainPage } from "@/three/terrain/terrain-page-builder";
import { TERRAIN_PROP_PAGE_SLOT_CAPACITY } from "@/three/terrain/terrain-prop-catalog";
import {
  ASPECT_HYPERSTRUCTURE_SEEDS,
  createAspectRaceTerrainRequests,
  frameAspectRaceCamera,
  projectRacePlateAnchors,
  RACE_TOWER_HEXES,
} from "./aspect-race-world";

describe("the Aspect race 3D world layout", () => {
  it("gives every Aspect its own procedural hyperstructure seed, family, crown and masonry tint", () => {
    const designs = aspects.map(({ id }) => resolveHyperstructureDesign(ASPECT_HYPERSTRUCTURE_SEEDS[id]));
    expect(new Set(aspects.map(({ id }) => ASPECT_HYPERSTRUCTURE_SEEDS[id])).size).toBe(aspects.length);
    expect(new Set(designs.map((design) => design.family)).size).toBe(aspects.length);
    expect(new Set(designs.map((design) => design.crown)).size).toBe(aspects.length);
    expect(new Set(designs.map((design) => design.masonryTint.join(","))).size).toBe(aspects.length);
  });

  it("places the four towers on hexes one apart inside varied explored world biomes", () => {
    const pages = createAspectRaceTerrainRequests();
    const cells = pages.flatMap((page) => page.cells);
    expect(RACE_TOWER_HEXES).toHaveLength(aspects.length);
    for (let index = 1; index < RACE_TOWER_HEXES.length; index += 1) {
      expect(RACE_TOWER_HEXES[index]!.col - RACE_TOWER_HEXES[index - 1]!.col).toBe(2);
      expect(RACE_TOWER_HEXES[index]!.row).toBe(RACE_TOWER_HEXES[0]!.row);
    }
    for (const hex of RACE_TOWER_HEXES) {
      const cell = cells.find((each) => each.col === hex.col && each.row === hex.row);
      expect(cell?.explored).toBe(true);
      expect(cell?.occupied).toBe(true);
      const inFront = cells.find((each) => each.col === hex.col && each.row === hex.row + 1);
      expect(inFront?.occupied).toBe(true);
    }
    expect(new Set(cells.map((cell) => cell.biome)).size).toBeGreaterThanOrEqual(4);
  });

  it("keeps every terrain page strictly below prop pool slot capacities so props are never thinned", () => {
    for (const page of createAspectRaceTerrainRequests()) {
      const prepared = prepareTerrainPage(page);
      expect(prepared.propInstances.length).toBeGreaterThan(0);
      const counts = new Map<string, number>();
      for (const instance of prepared.propInstances) {
        counts.set(instance.archetype, (counts.get(instance.archetype) ?? 0) + 1);
      }
      for (const [archetype, count] of counts) {
        expect(count, `${page.pageKey} ${archetype}`).toBeLessThan(
          TERRAIN_PROP_PAGE_SLOT_CAPACITY[archetype as keyof typeof TERRAIN_PROP_PAGE_SLOT_CAPACITY],
        );
      }
    }
  });

  it("projects four ordered plate anchors centered below the four towers on desktop and phone", () => {
    const entries = aspects.map(({ id }, index) => ({ aspectId: id, height: (4 - index) * 2_000, finished: false }));
    for (const aspect of [4.2, 1.8]) {
      const camera = new PerspectiveCamera(30, aspect, 0.1, 200);
      frameAspectRaceCamera(camera);
      const anchors = projectRacePlateAnchors(camera, entries, () => 0.4);
      expect(anchors).toHaveLength(aspects.length);
      for (let index = 1; index < anchors.length; index += 1) {
        expect(anchors[index]!.leftPercent).toBeGreaterThan(anchors[index - 1]!.leftPercent);
      }
      for (const anchor of anchors) {
        expect(anchor.leftPercent).toBeGreaterThan(5);
        expect(anchor.leftPercent).toBeLessThan(95);
        expect(anchor.topPercent).toBeGreaterThanOrEqual(58);
        expect(anchor.topPercent).toBeLessThanOrEqual(90);
      }
    }
  });

  it("fills every frustum corner with hex terrain across desktop, compact, and phone aspect ratios", () => {
    const cells = createAspectRaceTerrainRequests().flatMap((page) => page.cells);
    const xs = cells.map(({ col, row }) => terrainHexToWorld(col, row).x);
    const zs = cells.map(({ col, row }) => terrainHexToWorld(col, row).z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);

    for (const aspect of [6.0, 4.2, 3.2, 2.1, 1.6]) {
      const camera = new PerspectiveCamera(30, aspect, 0.1, 200);
      frameAspectRaceCamera(camera);
      camera.updateProjectionMatrix();
      for (const [ndcX, ndcY] of [
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1],
      ] as const) {
        const direction = new Vector3(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
        expect(direction.y).toBeLessThan(0);
        const hit = camera.position.clone().addScaledVector(direction, -camera.position.y / direction.y);
        expect(hit.x).toBeGreaterThan(minX);
        expect(hit.x).toBeLessThan(maxX);
        expect(hit.z).toBeGreaterThan(minZ);
        expect(hit.z).toBeLessThan(maxZ);
      }
    }
  });
});
