import { aspects } from "@bibliothecadao/types";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { resolveHyperstructureDesign } from "@/three/structures/hyperstructure-design";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import { prepareTerrainPage } from "@/three/terrain/terrain-page-builder";
import { setWorldOrigin, worldOrigin } from "@/three/world-origin";
import {
  ASPECT_HYPERSTRUCTURE_SEEDS,
  createAspectRaceTerrainRequests,
  frameAspectRaceCamera,
  projectRacePlateAnchors,
  RACE_TOWER_HEXES,
} from "./aspect-race-world";

const DEEP = { spacing: 100, rings: [{ radius: 7 }, { radius: 11 }, { radius: 15 }, { radius: 19 }] };

describe("the Aspect race 3D world layout", () => {
  it("gives every Aspect its own procedural hyperstructure seed, family, crown and masonry tint", () => {
    const designs = aspects.map(({ id }) => resolveHyperstructureDesign(ASPECT_HYPERSTRUCTURE_SEEDS[id]));
    expect(new Set(aspects.map(({ id }) => ASPECT_HYPERSTRUCTURE_SEEDS[id])).size).toBe(aspects.length);
    expect(new Set(designs.map((design) => design.family)).size).toBe(aspects.length);
    expect(new Set(designs.map((design) => design.crown)).size).toBe(aspects.length);
    expect(new Set(designs.map((design) => design.masonryTint.join(","))).size).toBe(aspects.length);
  });

  it("places the four towers on hexes one apart on the Deep's plaza, every cell the Deep's own floor", () => {
    const pages = createAspectRaceTerrainRequests(DEEP);
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
    expect(cells.every((cell) => cell.surfacePresentation === "deep" && cell.explored)).toBe(true);
    for (const hex of RACE_TOWER_HEXES) {
      expect(cells.find((each) => each.col === hex.col && each.row === hex.row)?.deepZone).toBe("plaza");
    }
    expect([...new Set(cells.map((cell) => cell.deepZone))]).toEqual(
      expect.arrayContaining(["plaza", "ring", "field"]),
    );
  });

  it("projects four ordered plate anchors centered below the four towers on desktop and phone", () => {
    const entries = aspects.map(({ id }, index) => ({ aspectId: id, height: (4 - index) * 2_000, finished: false }));
    for (const aspect of [4.2, 1.8]) {
      const camera = new PerspectiveCamera(30, aspect, 0.1, 200);
      frameAspectRaceCamera(camera);
      const anchors = projectRacePlateAnchors(camera, entries, [0.4, 0.4, 0.4, 0.4]);
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
    const cells = createAspectRaceTerrainRequests(DEEP).flatMap((page) => page.cells);
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

  it("anchors terrain geometry, camera, and plate projections near the floating world origin when playing deep in Frontier", () => {
    const previous = worldOrigin();
    const originCamera = new PerspectiveCamera(30, 3.6, 0.1, 200);
    frameAspectRaceCamera(originCamera);
    const entries = aspects.map(({ id }, index) => ({ aspectId: id, height: (4 - index) * 2_000, finished: false }));
    const originAnchors = projectRacePlateAnchors(originCamera, entries, [0.4, 0.4, 0.4, 0.4]);
    try {
      setWorldOrigin({ col: -1_236_511_808, row: -1_269_605_120 });
      const pages = createAspectRaceTerrainRequests(DEEP);
      expect(pages.length).toBeGreaterThan(0);
      for (const page of pages) {
        const floor = prepareTerrainPage(page).basaltInstances ?? new Float32Array();
        expect(floor.length).toBeGreaterThan(0);
        for (let index = 0; index < floor.length; index += 3) {
          expect(Math.abs(floor[index]!)).toBeLessThan(100);
          expect(Math.abs(floor[index + 1]!)).toBeLessThan(100);
        }
      }
      const shiftedCamera = new PerspectiveCamera(30, 3.6, 0.1, 200);
      frameAspectRaceCamera(shiftedCamera);
      expect(shiftedCamera.position.distanceTo(originCamera.position)).toBeLessThan(1e-6);
      expect(projectRacePlateAnchors(shiftedCamera, entries, [0.4, 0.4, 0.4, 0.4])).toEqual(originAnchors);
    } finally {
      setWorldOrigin(previous);
    }
  });
});
