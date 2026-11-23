import { aspects } from "@bibliothecadao/types";
import { PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";

import { resolveHyperstructureDesign } from "@/three/structures/hyperstructure-design";
import {
  ASPECT_HYPERSTRUCTURE_SEEDS,
  createAspectRaceTerrainRequest,
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
    const request = createAspectRaceTerrainRequest();
    expect(RACE_TOWER_HEXES).toHaveLength(aspects.length);
    for (let index = 1; index < RACE_TOWER_HEXES.length; index += 1) {
      expect(RACE_TOWER_HEXES[index]!.col - RACE_TOWER_HEXES[index - 1]!.col).toBe(2);
      expect(RACE_TOWER_HEXES[index]!.row).toBe(RACE_TOWER_HEXES[0]!.row);
    }
    for (const hex of RACE_TOWER_HEXES) {
      const cell = request.cells.find((each) => each.col === hex.col && each.row === hex.row);
      expect(cell?.explored).toBe(true);
      expect(cell?.occupied).toBe(true);
      const inFront = request.cells.find((each) => each.col === hex.col && each.row === hex.row + 1);
      expect(inFront?.occupied).toBe(true);
    }
    expect(new Set(request.cells.map((cell) => cell.biome)).size).toBeGreaterThanOrEqual(4);
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
});
