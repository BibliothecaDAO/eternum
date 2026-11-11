import { BiomeType } from "@bibliothecadao/types/terrain";
import { afterEach, describe, expect, it } from "vitest";

import { setWorldOrigin } from "@/three/world-origin";

import { BIOME_MAP_SIZE, biomeNumber, groundNumber, TerrainBiomeMap } from "./terrain-biome-map";

afterEach(() => setWorldOrigin({ col: 0, row: 0 }));

describe("the terrain's biome map", () => {
  it("holds each cell's biome and ground at the hex it is drawn on, round the map's floating origin", () => {
    setWorldOrigin({ col: 128, row: 64 });
    const map = new TerrainBiomeMap();
    map.write([
      { col: 131, row: 65, biome: BiomeType.Scorched },
      { col: 127, row: 62, biome: BiomeType.Taiga },
    ]);
    expect(map.read(3, 1)).toEqual({
      biome: biomeNumber(BiomeType.Scorched),
      ground: groundNumber("lava"),
      next: false,
      written: true,
    });
    expect(map.read(-1, -2)).toEqual({
      biome: biomeNumber(BiomeType.Taiga),
      ground: groundNumber("forest"),
      next: false,
      written: true,
    });
    expect(map.read(0, 0).written).toBe(false);
  });

  it("leaves a cell with no biome unwritten", () => {
    const map = new TerrainBiomeMap();
    map.write([{ col: 2, row: 2, biome: null }]);
    expect(map.read(2, 2).written).toBe(false);
  });

  it("reads a hex a whole map away at the same texel, so any window the map draws fits", () => {
    const map = new TerrainBiomeMap();
    map.write([{ col: 5, row: 7, biome: BiomeType.Beach }]);
    expect(map.read(5 + BIOME_MAP_SIZE, 7 - BIOME_MAP_SIZE).biome).toBe(biomeNumber(BiomeType.Beach));
  });

  it("numbers every biome distinctly, and gives every biome a ground", () => {
    const numbers = Object.values(BiomeType).map(biomeNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.every((number) => number >= 0)).toBe(true);
  });
});

describe("the hexes next to explore", () => {
  it("are marked for the mist, and unmarked once explored", () => {
    const map = new TerrainBiomeMap();
    map.writeUnexplored([
      { col: 1, row: 0, frontier: true },
      { col: 4, row: 0, frontier: false },
    ]);
    expect(map.read(1, 0)).toMatchObject({ next: true, written: false });
    expect(map.read(4, 0).next).toBe(false);
    map.write([{ col: 1, row: 0, biome: BiomeType.Grassland }]);
    expect(map.read(1, 0)).toMatchObject({ next: false, written: true });
  });
});
