import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";

import type { Land } from "./land-from-facts";
import { animalHomes, landRoamed } from "./wildlife-homes";

vi.mock("@/three/world-origin", () => ({
  worldHexAt: (x: number, z: number) => ({ col: Math.round(x), row: Math.round(z) }),
  worldHexToWorld: (col: number, row: number) => ({ x: col, z: row }),
}));

/** A land of one biome, `side` hexes a side, all explored but the last row. */
function landOf(biome: BiomeType, side = 12): Land {
  const hexes = Array.from({ length: side * side }, (_, index) => ({
    col: index % side,
    row: Math.floor(index / side),
    biome,
    explored: Math.floor(index / side) < side - 1,
  }));
  return { cells: [], hexes };
}

describe("animalHomes", () => {
  it("makes homes of some explored hexes of a biome an animal lives in, the same ones every time", () => {
    const land = landOf(BiomeType.Grassland);
    const homes = animalHomes(land);

    expect(homes.length).toBeGreaterThan(5);
    expect(homes.length).toBeLessThan(40);
    expect(homes.every((home) => home.species === "plains-zebra")).toBe(true);
    expect(homes.every((home) => home.at.z < 11)).toBe(true);
    expect(animalHomes(land)).toEqual(homes);
  });

  it("makes none where no animal lives", () => {
    expect(animalHomes(landOf(BiomeType.Ocean))).toEqual([]);
  });
});

describe("landRoamed", () => {
  it("lets an animal walk on explored land, and not on the unexplored, the sea, or beyond the land", () => {
    const roams = landRoamed(landOf(BiomeType.Grassland));
    expect(roams({ x: 3, z: 3 })).toBe(true);
    expect(roams({ x: 3, z: 11 })).toBe(false);
    expect(roams({ x: 40, z: 3 })).toBe(false);
    expect(landRoamed(landOf(BiomeType.Ocean))({ x: 3, z: 3 })).toBe(false);
  });
});
