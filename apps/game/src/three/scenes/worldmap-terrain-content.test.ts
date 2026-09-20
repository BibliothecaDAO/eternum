import { describe, expect, it } from "vitest";
import { WorldmapTerrainContent } from "./worldmap-terrain-content";

const cells = [
  { biomeKey: "Grassland", col: 11, row: 0 },
  { biomeKey: "Grassland", col: 12, row: 0 },
];
const input = (biomes = new Map<number, string>()) => ({
  cells,
  getProjectedBiome: (col: number) => biomes.get(col),
  isOccupied: () => false,
  getSurfacePresentation: (): "ethereal" | undefined => undefined,
  simulateAllExplored: false,
});

describe("worldmap authoritative terrain content", () => {
  it("derives a spire surface from current occupancy without changing its biome or neighboring cells", () => {
    const content = new WorldmapTerrainContent();
    const biomes = new Map([
      [11, "Snow"],
      [12, "Grassland"],
    ]);
    let spireCol: number | undefined = 11;
    const capture = () =>
      content.capture({
        ...input(biomes),
        isOccupied: (col) => col === spireCol,
        getSurfacePresentation: (col) => (col === spireCol ? "ethereal" : undefined),
      });
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
      [11, "Snow"],
      [12, "Beach"],
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
