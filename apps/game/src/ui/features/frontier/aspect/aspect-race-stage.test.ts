import { describe, expect, it } from "vitest";
import { aspects } from "@bibliothecadao/types";
import { resolveHyperstructureDesign } from "@/three/structures/hyperstructure-design";
import { ASPECT_HYPERSTRUCTURE_SEEDS, RACE_TOWER_HEXES, createAspectRaceTerrainRequest } from "./aspect-race-stage";

describe("the Aspect race 3D stage", () => {
  it("gives every Aspect its own procedural hyperstructure seed, family, crown and masonry tint", () => {
    const designs = aspects.map(({ id }) => resolveHyperstructureDesign(ASPECT_HYPERSTRUCTURE_SEEDS[id]));
    expect(new Set(aspects.map(({ id }) => ASPECT_HYPERSTRUCTURE_SEEDS[id])).size).toBe(aspects.length);
    expect(new Set(designs.map((design) => design.family)).size).toBe(aspects.length);
    expect(new Set(designs.map((design) => design.crown)).size).toBe(aspects.length);
    expect(new Set(designs.map((design) => design.masonryTint.join(","))).size).toBe(aspects.length);
  });

  it("places the four towers on hexes one apart inside the explored world terrain", () => {
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
    }
  });
});
