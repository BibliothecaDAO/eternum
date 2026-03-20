import { describe, expect, it } from "vitest";
// BiomeType enum values used directly to avoid transitive import issues in test env
enum BiomeType {
  None = "None",
  Ocean = "Ocean",
  Beach = "Beach",
  Grassland = "Grassland",
  Snow = "Snow",
  Tundra = "Tundra",
  Taiga = "Taiga",
}
import { snapshotExploredTilesRegion, lookupSnapshotBiome } from "./explored-tiles-snapshot";

function makeTiles(entries: Array<[number, number, BiomeType]>): Map<number, Map<number, BiomeType>> {
  const tiles = new Map<number, Map<number, BiomeType>>();
  for (const [col, row, biome] of entries) {
    if (!tiles.has(col)) tiles.set(col, new Map());
    tiles.get(col)!.set(row, biome);
  }
  return tiles;
}

describe("snapshotExploredTilesRegion", () => {
  it("captures tiles within the specified region", () => {
    const tiles = makeTiles([
      [10, 20, BiomeType.Ocean],
      [11, 21, BiomeType.Grassland],
      [100, 200, BiomeType.Snow], // outside region
    ]);

    const snapshot = snapshotExploredTilesRegion(tiles, {
      centerCol: 10,
      centerRow: 20,
      halfCols: 2,
      halfRows: 2,
    });

    expect(lookupSnapshotBiome(snapshot, 10, 20)).toBe(BiomeType.Ocean);
    expect(lookupSnapshotBiome(snapshot, 11, 21)).toBe(BiomeType.Grassland);
    expect(lookupSnapshotBiome(snapshot, 100, 200)).toBeUndefined();
  });

  it("returns a frozen copy immune to mutations on the source", () => {
    const tiles = makeTiles([
      [5, 5, BiomeType.Beach],
    ]);

    const snapshot = snapshotExploredTilesRegion(tiles, {
      centerCol: 5,
      centerRow: 5,
      halfCols: 1,
      halfRows: 1,
    });

    // Mutate source after snapshot
    tiles.get(5)!.set(5, BiomeType.Tundra);
    tiles.get(5)!.set(6, BiomeType.Snow);

    // Snapshot should still reflect original state
    expect(lookupSnapshotBiome(snapshot, 5, 5)).toBe(BiomeType.Beach);
    expect(lookupSnapshotBiome(snapshot, 5, 6)).toBeUndefined();
  });

  it("handles empty tiles map", () => {
    const tiles = new Map<number, Map<number, BiomeType>>();
    const snapshot = snapshotExploredTilesRegion(tiles, {
      centerCol: 0,
      centerRow: 0,
      halfCols: 5,
      halfRows: 5,
    });

    expect(lookupSnapshotBiome(snapshot, 0, 0)).toBeUndefined();
  });

  it("includes boundary hexes exactly at halfCols/halfRows distance", () => {
    const tiles = makeTiles([
      [3, 3, BiomeType.Taiga], // at boundary
      [4, 4, BiomeType.Snow],  // outside boundary
    ]);

    const snapshot = snapshotExploredTilesRegion(tiles, {
      centerCol: 0,
      centerRow: 0,
      halfCols: 3,
      halfRows: 3,
    });

    expect(lookupSnapshotBiome(snapshot, 3, 3)).toBe(BiomeType.Taiga);
    expect(lookupSnapshotBiome(snapshot, 4, 4)).toBeUndefined();
  });
});

describe("lookupSnapshotBiome", () => {
  it("returns undefined for missing column", () => {
    const snapshot = snapshotExploredTilesRegion(new Map(), {
      centerCol: 0,
      centerRow: 0,
      halfCols: 1,
      halfRows: 1,
    });
    expect(lookupSnapshotBiome(snapshot, 99, 99)).toBeUndefined();
  });

  it("returns undefined for existing column but missing row", () => {
    const tiles = makeTiles([[5, 5, BiomeType.Ocean]]);
    const snapshot = snapshotExploredTilesRegion(tiles, {
      centerCol: 5,
      centerRow: 5,
      halfCols: 1,
      halfRows: 1,
    });
    expect(lookupSnapshotBiome(snapshot, 5, 99)).toBeUndefined();
  });
});
