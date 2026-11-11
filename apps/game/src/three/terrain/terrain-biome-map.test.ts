import { BiomeType } from "@bibliothecadao/types/terrain";
import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { afterEach, describe, expect, it } from "vitest";

import { setWorldOrigin } from "@/three/world-origin";

import { BIOME_MAP_SIZE, biomeNumber, groundNumber, TerrainBiomeMap } from "./terrain-biome-map";
import { prepareTerrainPage } from "./terrain-page-builder";

const ZERO = { col: 0, row: 0 };

afterEach(() => setWorldOrigin(ZERO));

describe("the terrain's biome map", () => {
  it("holds each cell's biome and ground at the hex it is drawn on, round the map's floating origin", () => {
    const map = new TerrainBiomeMap();
    map.write(
      [
        { col: 131, row: 65, biome: BiomeType.Scorched },
        { col: 127, row: 62, biome: BiomeType.Taiga },
      ],
      { col: 128, row: 64 },
    );
    expect(map.read(3, 1)).toEqual({
      biome: biomeNumber(BiomeType.Scorched),
      ground: groundNumber("lava"),
      written: true,
    });
    expect(map.read(-1, -2)).toEqual({
      biome: biomeNumber(BiomeType.Taiga),
      ground: groundNumber("forest"),
      written: true,
    });
    expect(map.read(0, 0).written).toBe(false);
  });

  it("leaves a cell with no biome unwritten", () => {
    const map = new TerrainBiomeMap();
    map.write([{ col: 2, row: 2, biome: null }], ZERO);
    expect(map.read(2, 2).written).toBe(false);
  });

  it("reads a hex a whole map away at the same texel, so any window the map draws fits", () => {
    const map = new TerrainBiomeMap();
    map.write([{ col: 5, row: 7, biome: BiomeType.Beach }], ZERO);
    expect(map.read(5 + BIOME_MAP_SIZE, 7 - BIOME_MAP_SIZE).biome).toBe(biomeNumber(BiomeType.Beach));
  });

  it("numbers every biome distinctly, and gives every biome a ground", () => {
    const numbers = Object.values(BiomeType).map(biomeNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.every((number) => number >= 0)).toBe(true);
  });
});

describe("a page's biomes", () => {
  it("lie under the page's own hexes when the map's origin moved while the page was built", () => {
    // The realm view opened from its address: its page is laid out round origin 0, then the world map moves the origin
    // onto the realm's site before the page lands.
    const biome = BiomeType.TemperateDesert;
    const cell = { col: 3, row: 2, biome, explored: true, occupied: false, previewBiome: biome };
    const page = prepareTerrainPage({
      cells: [cell],
      climate: NEUTRAL_BIOME_CLIMATE,
      halo: [],
      mapCenter: 0,
      pageKey: "realm-view",
      roadSegments: [],
      settlementAnchors: [],
      strictBiomeParity: false,
    });
    setWorldOrigin({ col: -1_236_511_808, row: -1_269_605_120 });
    const map = new TerrainBiomeMap();

    map.write(page.request.cells, page.origin);

    expect(page.origin).toEqual(ZERO);
    expect(map.read(3, 2)).toMatchObject({ biome: biomeNumber(BiomeType.TemperateDesert), written: true });
  });
});
