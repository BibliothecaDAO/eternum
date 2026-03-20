import { describe, expect, it } from "vitest";
import { createProvisionalBiomeTracker, resolveArmySpawnBiome } from "./provisional-biome";

// Inline BiomeType values to avoid transitive import issues
const BiomeType = {
  Grassland: "Grassland",
  Ocean: "Ocean",
  Beach: "Beach",
} as const;

type BiomeValue = string;

function makeTiles(entries: Array<[number, number, BiomeValue]>): Map<number, Map<number, BiomeValue>> {
  const tiles = new Map<number, Map<number, BiomeValue>>();
  for (const [col, row, biome] of entries) {
    if (!tiles.has(col)) tiles.set(col, new Map());
    tiles.get(col)!.set(row, biome);
  }
  return tiles;
}

describe("createProvisionalBiomeTracker", () => {
  it("marks a tile as provisional", () => {
    const tracker = createProvisionalBiomeTracker();
    tracker.mark(10, 20);
    expect(tracker.isProvisional(10, 20)).toBe(true);
  });

  it("returns false for unmarked tiles", () => {
    const tracker = createProvisionalBiomeTracker();
    expect(tracker.isProvisional(10, 20)).toBe(false);
  });

  it("clears provisional mark for a specific tile", () => {
    const tracker = createProvisionalBiomeTracker();
    tracker.mark(10, 20);
    tracker.clear(10, 20);
    expect(tracker.isProvisional(10, 20)).toBe(false);
  });
});

describe("resolveArmySpawnBiome", () => {
  it("returns skip when tile already has authoritative biome", () => {
    const tiles = makeTiles([[5, 5, BiomeType.Ocean]]);

    const result = resolveArmySpawnBiome(tiles, 5, 5, BiomeType.Grassland);

    expect(result.action).toBe("skip");
  });

  it("returns write_provisional when tile has no biome", () => {
    const tiles = new Map<number, Map<number, BiomeValue>>();

    const result = resolveArmySpawnBiome(tiles, 5, 5, BiomeType.Grassland);

    expect(result.action).toBe("write_provisional");
    if (result.action === "write_provisional") {
      expect(result.biome).toBe(BiomeType.Grassland);
    }
  });

  it("returns skip when tile is already provisionally set", () => {
    const tiles = makeTiles([[5, 5, BiomeType.Grassland]]);
    const tracker = createProvisionalBiomeTracker();
    tracker.mark(5, 5);

    const result = resolveArmySpawnBiome(tiles, 5, 5, BiomeType.Grassland);

    // Already provisionally written — don't re-write
    expect(result.action).toBe("skip");
  });

  it("marks tile as provisional after write_provisional action", () => {
    const tiles = new Map<number, Map<number, BiomeValue>>();
    const tracker = createProvisionalBiomeTracker();

    const result = resolveArmySpawnBiome(tiles, 5, 5, BiomeType.Grassland);
    expect(result.action).toBe("write_provisional");

    // Caller would write to exploredTiles, then mark
    tracker.mark(5, 5);
    expect(tracker.isProvisional(5, 5)).toBe(true);
  });
});
