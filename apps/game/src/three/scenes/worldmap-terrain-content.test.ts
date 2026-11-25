import { describe, expect, it } from "vitest";
import { BiomeType } from "@bibliothecadao/types";
import { BASALT_SUPPORT_HEIGHT } from "../terrain/terrain-basalt";
import { TERRAIN_WATER_LEVEL } from "../terrain/terrain-water";
import { groundHeightOf, takeShownTiles, WorldmapTerrainContent } from "./worldmap-terrain-content";

const cells = [
  { biomeKey: "Grassland", col: 11, row: 0 },
  { biomeKey: "Grassland", col: 12, row: 0 },
];
const input = (biomes = new Map<number, BiomeType>(), spireCol?: number) => ({
  cells,
  readCell: (col: number) => ({
    projectedBiome: biomes.get(col),
    occupied: col === spireCol,
    surfacePresentation: col === spireCol ? ("ethereal" as const) : undefined,
  }),
  simulateAllExplored: false,
});

describe("worldmap authoritative terrain content", () => {
  it("derives a spire surface from current occupancy without changing its biome or neighboring cells", () => {
    const content = new WorldmapTerrainContent();
    const biomes = new Map([
      [11, BiomeType.Snow],
      [12, BiomeType.Grassland],
    ]);
    let spireCol: number | undefined = 11;
    const capture = () => content.capture(input(biomes, spireCol));
    expect(capture().cells).toEqual([
      { biomeKey: "Snow", col: 11, row: 0, occupied: true, surfacePresentation: "ethereal" },
      { biomeKey: "Grassland", col: 12, row: 0, occupied: false, surfacePresentation: undefined },
    ]);
    spireCol = undefined;
    expect(capture().cells[0]).toMatchObject({ biomeKey: "Snow", occupied: false, surfacePresentation: undefined });
  });
  it("keeps subsequent camera captures atomic until the authoritative change completes", () => {
    const content = new WorldmapTerrainContent();
    expect(content.capture(input()).commitMode).toBe("ambient");
    content.invalidate();
    const authoritative = content.capture(input());
    expect(authoritative.commitMode).toBe("atomic");
    expect(content.capture(input()).commitMode).toBe("atomic");
    content.presented(authoritative);
    expect(content.capture(input()).commitMode).toBe("ambient");
  });

  it("cannot let a stale completion release a newer authoritative update", () => {
    const content = new WorldmapTerrainContent();
    content.invalidate();
    const old = content.capture(input());
    content.invalidate();
    const latest = content.capture(input());
    content.presented(old);
    expect(content.capture(input()).commitMode).toBe("atomic");
    content.presented(latest);
    content.presented(old);
    expect(content.capture(input()).commitMode).toBe("ambient");
  });

  it("captures a cross-page update and a removal from current facts, even with stale coverage cells", () => {
    const content = new WorldmapTerrainContent();
    const biomes = new Map([
      [11, BiomeType.Snow],
      [12, BiomeType.Beach],
    ]);
    content.invalidate();
    expect(content.capture(input(biomes)).cells.map((cell) => cell.biomeKey)).toEqual(["Snow", "Beach"]);
    biomes.delete(11);
    content.invalidate();
    expect(content.capture(input(biomes)).cells.map((cell) => cell.biomeKey)).toEqual(["Outline", "Beach"]);
  });

  it("uses synthetic biome coverage only in explicit simulation and clears lifecycle bookkeeping", () => {
    const content = new WorldmapTerrainContent();
    content.invalidate();
    const old = content.capture(input());
    content.clear();
    content.presented(old);
    expect(content.capture(input()).commitMode).toBe("ambient");
    expect(content.capture({ ...input(), simulateAllExplored: true }).cells[0].biomeKey).toBe("Grassland");
    content.invalidate();
    content.presented(old);
    expect(content.capture(input()).commitMode).toBe("atomic");
  });
});

describe("takeShownTiles", () => {
  const center = 100;
  // Ten-tile pages from the origin: (5, -2) lies on the page starting at row -10, col 0.
  const page = { key: "-10,0", size: { width: 10, height: 10 }, origin: { col: 0, row: 0 } };

  it("shows an awaited tile once a presented cell draws its biome, and only once", () => {
    const awaiting = new Map([["105,98", ["explore-1"]]]);
    const cells = [{ col: 5, row: -2, biomeKey: "Grassland" }];

    expect(takeShownTiles(awaiting, cells, center, page)).toEqual([["105,98", ["explore-1"]]]);
    expect(takeShownTiles(awaiting, cells, center, page)).toEqual([]);
  });

  it("keeps waiting while the presented cell still draws the unexplored outline, or is not presented at all", () => {
    const awaiting = new Map([["105,98", ["explore-1"]]]);

    expect(takeShownTiles(awaiting, [{ col: 5, row: -2, biomeKey: "Outline" }], center, page)).toEqual([]);
    expect(takeShownTiles(awaiting, [{ col: 6, row: -2, biomeKey: "Grassland" }], center, page)).toEqual([]);
    expect(awaiting.has("105,98")).toBe(true);
  });

  it("keeps waiting while the page presented is not the one that draws the tile", () => {
    const awaiting = new Map([["105,98", ["explore-1"]]]);
    const cells = [{ col: 5, row: -2, biomeKey: "Grassland" }];

    expect(takeShownTiles(awaiting, cells, center, { ...page, key: "0,0" })).toEqual([]);
    expect(takeShownTiles(awaiting, cells, center, page)).toEqual([["105,98", ["explore-1"]]]);
  });
});

describe("the ground a tile's facts put under what stands on it", () => {
  const facts = (projectedBiome: BiomeType | undefined, more: { occupied?: boolean; surfacePresentation?: "ethereal" } = {}) => ({
    projectedBiome,
    occupied: more.occupied ?? false,
    surfacePresentation: more.surfacePresentation,
  });

  it("is one height for fog and every dry biome, the water's surface on water, and the basalt plane on a spire's tile", () => {
    expect(groundHeightOf(facts(undefined))).toBe(0);
    expect(groundHeightOf(facts(BiomeType.Snow))).toBe(0);
    expect(groundHeightOf(facts(BiomeType.Grassland))).toBe(0);
    expect(groundHeightOf(facts(BiomeType.Ocean))).toBe(TERRAIN_WATER_LEVEL);
    expect(groundHeightOf(facts(BiomeType.DeepOcean))).toBe(TERRAIN_WATER_LEVEL);
    expect(groundHeightOf(facts(BiomeType.Ocean, { occupied: true }))).toBe(0);
    expect(groundHeightOf(facts(BiomeType.Snow, { surfacePresentation: "ethereal" }))).toBe(BASALT_SUPPORT_HEIGHT);
  });
});
