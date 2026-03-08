import { describe, it, expect } from "vitest";
import {
  findPath,
  directionBetween,
  buildTileIndex,
} from "../../../src/world/pathfinding.js";
import { Direction } from "@bibliothecadao/types";
import type { TileState, Position } from "@bibliothecadao/client";

// Helper: create a set of explored tiles in a rectangular area
function exploredRect(minX: number, minY: number, maxX: number, maxY: number): Set<string> {
  const s = new Set<string>();
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      s.add(`${x},${y}`);
    }
  }
  return s;
}

// Uniform cost function (1 stamina per hex) for tests
const uniformCost = () => 1;

describe("directionBetween", () => {
  it("returns EAST for +1,0 on even row", () => {
    expect(directionBetween({ x: 5, y: 4 }, { x: 6, y: 4 })).toBe(Direction.EAST);
  });

  it("returns WEST for -1,0 on even row", () => {
    expect(directionBetween({ x: 5, y: 4 }, { x: 4, y: 4 })).toBe(Direction.WEST);
  });

  it("returns NORTH_EAST for even row (+1,+1)", () => {
    expect(directionBetween({ x: 5, y: 4 }, { x: 6, y: 5 })).toBe(Direction.NORTH_EAST);
  });

  it("returns NORTH_EAST for odd row (0,+1)", () => {
    expect(directionBetween({ x: 5, y: 3 }, { x: 5, y: 4 })).toBe(Direction.NORTH_EAST);
  });

  it("returns null for non-adjacent hexes", () => {
    expect(directionBetween({ x: 0, y: 0 }, { x: 3, y: 3 })).toBeNull();
  });
});

describe("findPath — straight line", () => {
  const explored = exploredRect(0, 0, 10, 10);
  const blocked = new Set<string>();

  it("returns empty directions for same start and end", () => {
    const result = findPath({ x: 5, y: 5 }, { x: 5, y: 5 }, explored, blocked, 20, uniformCost);
    expect(result).not.toBeNull();
    expect(result!.distance).toBe(0);
    expect(result!.directions).toEqual([]);
  });

  it("finds path to adjacent hex", () => {
    const result = findPath({ x: 5, y: 4 }, { x: 6, y: 4 }, explored, blocked, 20, uniformCost);
    expect(result).not.toBeNull();
    expect(result!.distance).toBe(1);
    expect(result!.directions).toEqual([Direction.EAST]);
  });

  it("finds multi-step east path", () => {
    const result = findPath({ x: 2, y: 4 }, { x: 5, y: 4 }, explored, blocked, 20, uniformCost);
    expect(result).not.toBeNull();
    expect(result!.distance).toBe(3);
    // Every step should be EAST
    for (const d of result!.directions) {
      expect(d).toBe(Direction.EAST);
    }
  });
});

describe("findPath — obstacles", () => {
  const explored = exploredRect(0, 0, 10, 10);

  it("routes around a blocked hex", () => {
    const blocked = new Set(["5,5"]);
    const result = findPath({ x: 4, y: 5 }, { x: 6, y: 5 }, explored, blocked, 20, uniformCost);
    expect(result).not.toBeNull();
    // Must go around: at least 2 steps (can't go through 5,5)
    expect(result!.distance).toBeGreaterThanOrEqual(2);
    // Should not pass through 5,5
    for (const pos of result!.path) {
      expect(`${pos.x},${pos.y}`).not.toBe("5,5");
    }
  });

  it("allows end position even if it's in blocked set", () => {
    const blocked = new Set(["6,5"]);
    const result = findPath({ x: 5, y: 5 }, { x: 6, y: 5 }, explored, blocked, 20, uniformCost);
    expect(result).not.toBeNull();
    expect(result!.distance).toBe(1);
  });

  it("returns null when completely blocked", () => {
    // Block all neighbors of start
    const blocked = new Set(["1,0", "1,1", "0,1", "-1,0", "0,-1", "1,-1"]);
    const result = findPath({ x: 0, y: 0 }, { x: 5, y: 5 }, explored, blocked, 20, uniformCost);
    expect(result).toBeNull();
  });
});

describe("findPath — unexplored tiles", () => {
  it("cannot path through unexplored tiles", () => {
    // Only a 3-wide corridor explored
    const explored = new Set(["0,0", "1,0", "2,0"]);
    // Target is explored but not reachable without going off-corridor
    const result = findPath({ x: 0, y: 0 }, { x: 0, y: 2 }, explored, new Set(), 20, uniformCost);
    expect(result).toBeNull();
  });
});

describe("findPath — max steps", () => {
  const explored = exploredRect(0, 0, 20, 20);
  const blocked = new Set<string>();

  it("returns reachedLimit when target is beyond max steps", () => {
    const result = findPath({ x: 0, y: 0 }, { x: 10, y: 0 }, explored, blocked, 3, uniformCost);
    expect(result).not.toBeNull();
    expect(result!.reachedLimit).toBe(true);
    expect(result!.distance).toBe(10);
  });

  it("finds path within max steps with reachedLimit false", () => {
    const result = findPath({ x: 0, y: 0 }, { x: 3, y: 0 }, explored, blocked, 3, uniformCost);
    expect(result).not.toBeNull();
    expect(result!.reachedLimit).toBe(false);
    expect(result!.distance).toBeLessThanOrEqual(3);
  });
});

describe("findPath — direction consistency", () => {
  const explored = exploredRect(0, 0, 10, 10);
  const blocked = new Set<string>();

  it("directions array matches path positions", () => {
    const result = findPath({ x: 2, y: 3 }, { x: 6, y: 7 }, explored, blocked, 20, uniformCost);
    expect(result).not.toBeNull();

    // Each direction should correspond to the actual step between path positions
    for (let i = 0; i < result!.directions.length; i++) {
      const dir = directionBetween(result!.path[i], result!.path[i + 1]);
      expect(dir).toBe(result!.directions[i]);
    }
  });
});

describe("buildTileIndex", () => {
  it("marks explored tiles", () => {
    const tiles: TileState[] = [
      { position: { x: 0, y: 0 }, biome: 11, occupierId: 0, occupierType: 0, occupierIsStructure: false, rewardExtracted: false },
      { position: { x: 1, y: 0 }, biome: 11, occupierId: 0, occupierType: 0, occupierIsStructure: false, rewardExtracted: false },
    ];
    const idx = buildTileIndex(tiles);
    expect(idx.explored.has("0,0")).toBe(true);
    expect(idx.explored.has("1,0")).toBe(true);
    expect(idx.explored.has("2,0")).toBe(false);
  });

  it("marks structures as blocked", () => {
    const tiles: TileState[] = [
      { position: { x: 5, y: 5 }, biome: 11, occupierId: 1, occupierType: 1, occupierIsStructure: true, rewardExtracted: false },
    ];
    const idx = buildTileIndex(tiles);
    expect(idx.blocked.has("5,5")).toBe(true);
  });

  it("marks explorers as blocked", () => {
    const tiles: TileState[] = [
      { position: { x: 3, y: 3 }, biome: 11, occupierId: 42, occupierType: 15, occupierIsStructure: false, rewardExtracted: false },
    ];
    const idx = buildTileIndex(tiles);
    expect(idx.blocked.has("3,3")).toBe(true);
  });

  it("does not block empty tiles", () => {
    const tiles: TileState[] = [
      { position: { x: 0, y: 0 }, biome: 11, occupierId: 0, occupierType: 0, occupierIsStructure: false, rewardExtracted: false },
    ];
    const idx = buildTileIndex(tiles);
    expect(idx.blocked.has("0,0")).toBe(false);
  });
});
