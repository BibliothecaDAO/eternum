import { describe, it, expect } from "vitest";
import { findPath, getBiomeTravelCost, DEFAULT_COST_CONFIG, type TileInfo, type PathCostConfig } from "../../src/adapter/pathfinder";
import { BiomeTypeToId, BiomeType, Direction, TroopType } from "@bibliothecadao/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a tile map from a compact spec: {col, row, biome} */
function makeTileMap(
  tiles: { col: number; row: number; biome: BiomeType }[],
): Map<string, TileInfo> {
  const map = new Map<string, TileInfo>();
  for (const t of tiles) {
    map.set(`${t.col},${t.row}`, {
      biome: BiomeTypeToId[t.biome],
      occupierType: 0,
      occupierId: 0,
    });
  }
  return map;
}

/** Fill a rectangular region with a biome. */
function fillRect(
  col0: number,
  row0: number,
  col1: number,
  row1: number,
  biome: BiomeType,
): { col: number; row: number; biome: BiomeType }[] {
  const tiles: { col: number; row: number; biome: BiomeType }[] = [];
  for (let c = col0; c <= col1; c++) {
    for (let r = row0; r <= row1; r++) {
      tiles.push({ col: c, row: r, biome });
    }
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("pathfinder", () => {
  describe("trivial cases", () => {
    it("returns empty path when start == end", () => {
      const result = findPath(5, 5, 5, 5, new Map());
      expect(result.found).toBe(true);
      expect(result.path).toEqual([]);
      expect(result.totalCost).toBe(0);
      expect(result.actionBatches).toEqual([]);
    });

    it("returns found=false when target is ocean", () => {
      const tileMap = makeTileMap([
        { col: 10, row: 10, biome: BiomeType.Ocean },
      ]);
      const result = findPath(5, 5, 10, 10, tileMap);
      expect(result.found).toBe(false);
    });

    it("returns found=false when target is deep ocean", () => {
      const tileMap = makeTileMap([
        { col: 6, row: 5, biome: BiomeType.DeepOcean },
      ]);
      const result = findPath(5, 5, 6, 5, tileMap);
      expect(result.found).toBe(false);
    });

    it("finds adjacent tile in one step", () => {
      // (5,4) is even row, east neighbor is (6,4)
      const tileMap = makeTileMap([
        { col: 5, row: 4, biome: BiomeType.Grassland },
        { col: 6, row: 4, biome: BiomeType.Grassland },
      ]);
      const result = findPath(5, 4, 6, 4, tileMap);
      expect(result.found).toBe(true);
      expect(result.path.length).toBe(1);
      expect(result.path[0].col).toBe(6);
      expect(result.path[0].row).toBe(4);
      expect(result.path[0].direction).toBe(Direction.EAST);
      expect(result.path[0].explored).toBe(true);
      expect(result.totalCost).toBe(10);
    });
  });

  describe("straight-line paths through explored tiles", () => {
    it("travels 5 hexes east through grassland", () => {
      // Even row: east neighbor is (col+1, row)
      const tiles = [];
      for (let c = 0; c <= 5; c++) {
        tiles.push({ col: c, row: 4, biome: BiomeType.Grassland });
      }
      const tileMap = makeTileMap(tiles);
      const result = findPath(0, 4, 5, 4, tileMap);

      expect(result.found).toBe(true);
      expect(result.path.length).toBe(5);
      expect(result.totalCost).toBe(50); // 5 * 10
      // Should be a single travel batch
      expect(result.actionBatches.length).toBe(1);
      expect(result.actionBatches[0].type).toBe("travel");
      expect(result.actionBatches[0].directions.length).toBe(5);
      expect(result.actionBatches[0].cost).toBe(50);
    });
  });

  describe("unexplored tiles", () => {
    it("paths through unknown tiles as explore actions", () => {
      // Empty tile map = all unexplored
      const result = findPath(0, 4, 3, 4, new Map());

      expect(result.found).toBe(true);
      expect(result.path.length).toBe(3);
      expect(result.totalCost).toBe(90); // 3 * 30
      // Each unexplored tile should be a separate explore batch
      expect(result.actionBatches.length).toBe(3);
      for (const batch of result.actionBatches) {
        expect(batch.type).toBe("explore");
        expect(batch.directions.length).toBe(1);
        expect(batch.cost).toBe(30);
      }
    });
  });

  describe("action batch grouping", () => {
    it("groups explored tiles into travel batches and unexplored into individual explore batches", () => {
      // Path: 2 explored, then 2 unexplored, then 1 explored
      // (0,4) → (1,4) explored → (2,4) explored → (3,4) unexplored → (4,4) unexplored → (5,4) explored
      const tileMap = makeTileMap([
        { col: 0, row: 4, biome: BiomeType.Grassland },
        { col: 1, row: 4, biome: BiomeType.Grassland },
        { col: 2, row: 4, biome: BiomeType.Grassland },
        // 3,4 and 4,4 are NOT in tile map = unexplored
        { col: 5, row: 4, biome: BiomeType.Grassland },
      ]);
      const result = findPath(0, 4, 5, 4, tileMap);

      expect(result.found).toBe(true);
      expect(result.path.length).toBe(5);
      // Batches: travel(2 explored) + explore(1) + explore(1) + travel(1 explored)
      expect(result.actionBatches.length).toBe(4);
      expect(result.actionBatches[0].type).toBe("travel");
      expect(result.actionBatches[0].directions.length).toBe(2);
      expect(result.actionBatches[1].type).toBe("explore");
      expect(result.actionBatches[2].type).toBe("explore");
      expect(result.actionBatches[3].type).toBe("travel");
      expect(result.actionBatches[3].directions.length).toBe(1);
    });
  });

  describe("obstacle avoidance", () => {
    it("routes around an ocean tile", () => {
      // Grid: row 4, cols 0-4 all grassland, except (2,4) is ocean
      // Must detour through row 3 or 5
      const tiles = [
        ...fillRect(0, 3, 4, 5, BiomeType.Grassland),
      ];
      // Override (2,4) with ocean
      const tileMap = makeTileMap(tiles);
      tileMap.set("2,4", {
        biome: BiomeTypeToId[BiomeType.Ocean],
        occupierType: 0,
        occupierId: 0,
      });

      const result = findPath(0, 4, 4, 4, tileMap);
      expect(result.found).toBe(true);
      // Path should NOT go through (2,4)
      const pathCoords = result.path.map((s) => `${s.col},${s.row}`);
      expect(pathCoords).not.toContain("2,4");
      // Should be longer than 4 (direct would be 4 steps)
      expect(result.path.length).toBeGreaterThan(4);
    });

    it("returns not found when target is surrounded by ocean", () => {
      // Target at (5,4), surround it with ocean on all 6 neighbors
      const tileMap = makeTileMap([
        { col: 0, row: 4, biome: BiomeType.Grassland },
        { col: 5, row: 4, biome: BiomeType.Grassland },
      ]);
      // Block all 6 neighbors of (5,4) — even row
      const oceanNeighbors = [
        [6, 4], [6, 5], [5, 5], [4, 4], [5, 3], [6, 3],
      ];
      for (const [c, r] of oceanNeighbors) {
        tileMap.set(`${c},${r}`, {
          biome: BiomeTypeToId[BiomeType.Ocean],
          occupierType: 0,
          occupierId: 0,
        });
      }
      const result = findPath(0, 4, 5, 4, tileMap, DEFAULT_COST_CONFIG, 50);
      expect(result.found).toBe(false);
    });
  });

  describe("heuristic correctness", () => {
    it("finds optimal path cost on a small grid", () => {
      // 3x3 grid of grassland, find path from (0,0) to (2,0) — should be 2 steps, cost 20
      const tiles = fillRect(0, 0, 3, 2, BiomeType.Grassland);
      const tileMap = makeTileMap(tiles);
      const result = findPath(0, 0, 2, 0, tileMap);
      expect(result.found).toBe(true);
      expect(result.totalCost).toBe(20); // 2 * 10
      expect(result.path.length).toBe(2);
    });
  });

  describe("edge cases", () => {
    it("handles maxSteps limit", () => {
      // Try to find a long path with very low maxSteps
      const result = findPath(0, 0, 50, 0, new Map(), DEFAULT_COST_CONFIG, 2);
      expect(result.found).toBe(false);
    });

    it("handles large explored grid efficiently", () => {
      // 30x30 grid of grassland
      const tiles = fillRect(0, 0, 30, 30, BiomeType.Grassland);
      const tileMap = makeTileMap(tiles);

      const start = performance.now();
      const result = findPath(0, 0, 25, 25, tileMap, DEFAULT_COST_CONFIG, 500);
      const elapsed = performance.now() - start;

      expect(result.found).toBe(true);
      expect(result.path.length).toBeGreaterThan(0);
      // Should complete well under 1 second
      expect(elapsed).toBeLessThan(1000);
    });

    it("respects custom cost config", () => {
      // 3 unexplored tiles with custom explore cost of 50
      const config: PathCostConfig = { ...DEFAULT_COST_CONFIG, exploreCost: 50 };
      const result = findPath(0, 4, 3, 4, new Map(), config);
      expect(result.found).toBe(true);
      expect(result.totalCost).toBe(150); // 3 * 50
    });

    it("each path step has correct explored flag", () => {
      const tileMap = makeTileMap([
        { col: 0, row: 4, biome: BiomeType.Grassland },
        { col: 1, row: 4, biome: BiomeType.Grassland },
        // (2,4) missing = unexplored
      ]);
      const result = findPath(0, 4, 2, 4, tileMap);
      expect(result.found).toBe(true);
      expect(result.path[0].explored).toBe(true);
      expect(result.path[1].explored).toBe(false);
    });
  });

  describe("biome-aware costs", () => {
    it("getBiomeTravelCost returns base cost for beach (no modifier)", () => {
      expect(getBiomeTravelCost(BiomeType.Beach, DEFAULT_COST_CONFIG)).toBe(10);
    });

    it("getBiomeTravelCost gives paladin bonus in grassland", () => {
      const paladinConfig: PathCostConfig = { ...DEFAULT_COST_CONFIG, troopType: TroopType.Paladin };
      expect(getBiomeTravelCost(BiomeType.Grassland, paladinConfig)).toBe(0); // 10 - 10
    });

    it("getBiomeTravelCost gives paladin penalty in tropical rain forest", () => {
      const paladinConfig: PathCostConfig = { ...DEFAULT_COST_CONFIG, troopType: TroopType.Paladin };
      expect(getBiomeTravelCost(BiomeType.TropicalRainForest, paladinConfig)).toBe(20); // 10 + 10
    });

    it("getBiomeTravelCost gives no paladin modifier for knight in grassland", () => {
      expect(getBiomeTravelCost(BiomeType.Grassland, DEFAULT_COST_CONFIG)).toBe(10);
    });

    it("scorched costs more for all troop types", () => {
      expect(getBiomeTravelCost(BiomeType.Scorched, DEFAULT_COST_CONFIG)).toBe(20); // 10 + 10
    });

    it("pathfinder uses biome costs to prefer cheaper terrain", () => {
      // Two routes to (4,4): through scorched (row 4) or detour through grassland (row 5)
      const tiles = fillRect(0, 3, 5, 5, BiomeType.Grassland);
      const tileMap = makeTileMap(tiles);
      // Make row 4, cols 1-3 scorched
      for (let c = 1; c <= 3; c++) {
        tileMap.set(`${c},4`, {
          biome: BiomeTypeToId[BiomeType.Scorched],
          occupierType: 0,
          occupierId: 0,
        });
      }
      const result = findPath(0, 4, 4, 4, tileMap);
      expect(result.found).toBe(true);
      // Direct through 4 scorched would cost 80 (4*20), detour should be cheaper
      expect(result.totalCost).toBeLessThan(80);
    });
  });
});
