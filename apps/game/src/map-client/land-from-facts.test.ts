import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";

import { latticeToWorld } from "@/three/utils/hex-lattice";

import { landAround, neighboursOf } from "./land-from-facts";

const tile = (col: number, row: number, biome: BiomeType, occupied = false) => ({
  col,
  row,
  biome: BiomeTypeToId[biome],
  occupied,
});

describe("neighboursOf", () => {
  it.each([
    [0, 0],
    [3, 1],
    [-2, -3],
    [5, -4],
  ])("names the six hexes one hex away from (%i, %i) on the map's lattice", (col, row) => {
    const here = latticeToWorld(col, row);
    const distances = neighboursOf({ col, row }).map((hex) => {
      const there = latticeToWorld(hex.col, hex.row);
      return Math.hypot(there.x - here.x, there.z - here.z);
    });
    expect(distances).toHaveLength(6);
    for (const distance of distances) expect(distance).toBeCloseTo(Math.sqrt(3), 5);
    expect(new Set(neighboursOf({ col, row }).map((hex) => `${hex.col},${hex.row}`)).size).toBe(6);
  });
});

describe("landAround", () => {
  it("gives the terrain its explored tiles and rings them with the hexes next to explore", () => {
    const land = landAround(
      [tile(0, 0, BiomeType.Grassland), tile(1, 0, BiomeType.Ocean, true)],
      { col: 0, row: 0 },
      8,
    );
    expect(land.cells).toEqual([
      { col: 0, row: 0, biome: BiomeType.Grassland, occupied: false },
      { col: 1, row: 0, biome: BiomeType.Ocean, occupied: true },
    ]);
    const explored = land.hexes.filter((hex) => hex.explored);
    const next = land.hexes.filter((hex) => !hex.explored);
    expect(explored.map((hex) => [hex.col, hex.row, hex.biome])).toEqual([
      [0, 0, BiomeType.Grassland],
      [1, 0, BiomeType.Ocean],
    ]);
    // Two hexes side by side have eight hexes round them.
    expect(next).toHaveLength(8);
    expect(next.every((hex) => hex.biome === BiomeType.None)).toBe(true);
    expect(next.some((hex) => hex.col === 0 && hex.row === 0)).toBe(false);
  });

  it("leaves out what lies past its reach", () => {
    const land = landAround([tile(0, 0, BiomeType.Grassland), tile(40, 0, BiomeType.Snow)], { col: 0, row: 0 }, 8);
    expect(land.cells.map((cell) => cell.col)).toEqual([0]);
  });

  it("says so and leaves the tile out when a tile's biome is unknown to the client", () => {
    const loud = vi.spyOn(console, "error").mockImplementation(() => {});
    const land = landAround([{ col: 0, row: 0, biome: 999, occupied: false }], { col: 0, row: 0 }, 8);
    expect(land.cells).toEqual([]);
    expect(loud).toHaveBeenCalledWith("The map knows no biome 999 for the tile at 0,0");
    loud.mockRestore();
  });
});
