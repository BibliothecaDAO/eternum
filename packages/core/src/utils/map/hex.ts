/**
 * Hexagonal coordinate system implementation
 * Based on https://www.redblobgames.com/grids/hexagons/
 */

import { Direction, TileOccupier } from "@bibliothecadao/types";

// Helper function to get all directions
export function getAllHexDirections(): Direction[] {
  return [
    Direction.EAST,
    Direction.NORTH_EAST,
    Direction.NORTH_WEST,
    Direction.WEST,
    Direction.SOUTH_WEST,
    Direction.SOUTH_EAST,
  ];
}

/**
 * Represents a cube coordinate in a hex grid
 */
export class Cube {
  constructor(
    public q: number,
    public r: number,
    public s: number,
  ) {}

  static zero(): Cube {
    return new Cube(0, 0, 0);
  }

  subtract(other: Cube): Cube {
    return new Cube(this.q - other.q, this.r - other.r, this.s - other.s);
  }

  abs(): Cube {
    return new Cube(Math.abs(this.q), Math.abs(this.r), Math.abs(this.s));
  }

  distance(other: Cube): number {
    // Calculate difference between cubes
    const cubeDiff = this.subtract(other);
    const absCubeDiff = cubeDiff.abs();

    // Get max(absCubeDiff.q, absCubeDiff.r, absCubeDiff.s)
    return Math.max(absCubeDiff.q, absCubeDiff.r, absCubeDiff.s);
  }
}

/**
 * Represents a 2D coordinate in a hex grid
 */
export class Coord {
  constructor(
    public x: number,
    public y: number,
  ) {}

  toString(): string {
    return `Coord (x:${this.x}, y:${this.y})`;
  }

  neighbor(direction: Direction): Coord {
    // https://www.redblobgames.com/grids/hexagons/#neighbors-offset
    // even-r
    if (this.y % 2 === 0) {
      // Where y (row) is even
      switch (direction) {
        case Direction.EAST:
          return new Coord(this.x + 1, this.y);
        case Direction.NORTH_EAST:
          return new Coord(this.x + 1, this.y + 1);
        case Direction.NORTH_WEST:
          return new Coord(this.x, this.y + 1);
        case Direction.WEST:
          return new Coord(this.x - 1, this.y);
        case Direction.SOUTH_WEST:
          return new Coord(this.x, this.y - 1);
        case Direction.SOUTH_EAST:
          return new Coord(this.x + 1, this.y - 1);
      }
    } else {
      // Where y (row) is odd
      switch (direction) {
        case Direction.EAST:
          return new Coord(this.x + 1, this.y);
        case Direction.NORTH_EAST:
          return new Coord(this.x, this.y + 1);
        case Direction.NORTH_WEST:
          return new Coord(this.x - 1, this.y + 1);
        case Direction.WEST:
          return new Coord(this.x - 1, this.y);
        case Direction.SOUTH_WEST:
          return new Coord(this.x - 1, this.y - 1);
        case Direction.SOUTH_EAST:
          return new Coord(this.x, this.y - 1);
      }
    }
  }

  toCube(): Cube {
    // https://www.redblobgames.com/grids/hexagons/#conversions-offset
    // Convert odd-r to cube coordinates
    const col = this.x;
    const row = this.y;
    const q = col - Math.floor((row - (this.y % 2)) / 2);
    const r = row;
    const s = -q - r;

    return new Cube(q, r, s);
  }

  distance(other: Coord): number {
    return this.toCube().distance(other.toCube());
  }

  /**
   * Travels n steps in the specified direction
   * @param direction - HexDirection to travel
   * @param steps - Number of steps to take
   * @returns New coordinate after traveling
   */
  travel(direction: Direction, steps: number): Coord {
    let current: Coord = this;
    for (let i = 0; i < steps; i++) {
      current = current.neighbor(direction) as Coord;
    }
    return current;
  }
}

/**
 * Utility class for hexagonal grid operations
 */
export class HexGrid {
  // Constants
  static readonly CENTER = 2147483646;
  static readonly HIGHEST_COL = 2147484147;
  static readonly LOWEST_COL = 2147483647;
  static readonly HIGHEST_ROW = 2147483947;
  static readonly LOWEST_ROW = 2147483647;
  static readonly HEX_DISTANCE_TO_KM = 1;

  /**
   * Calculates travel time between two coordinates
   * @param from - Starting coordinate
   * @param to - Ending coordinate
   * @param secPerKm - Seconds per kilometer
   * @returns Travel time in seconds
   */
  static travelTime(from: Coord, to: Coord, secPerKm: number): number {
    const distance = from.distance(to) * HexGrid.HEX_DISTANCE_TO_KM;
    return Math.floor(distance * secPerKm);
  }

  /**
   * Finds coordinates that are exactly n steps away from the center in each direction
   * @param steps - Number of steps from center
   * @returns Map of directions to their coordinates
   */
  static findHexCoordsfromCenter(steps: number): Record<Direction, Coord> {
    const center = new Coord(HexGrid.CENTER, HexGrid.CENTER);
    const result: Partial<Record<Direction, Coord>> = {};

    getAllHexDirections().forEach((direction) => {
      result[direction] = center.travel(direction, steps);
    });

    return result as Record<Direction, Coord>;
  }
}

export const isTileOccupierStructure = (tileOccupier: TileOccupier) => {
  return (
    tileOccupier === TileOccupier.RealmRegularLevel1 ||
    tileOccupier === TileOccupier.RealmWonderLevel1 ||
    tileOccupier === TileOccupier.RealmRegularLevel1WonderBonus ||
    tileOccupier === TileOccupier.HyperstructureLevel1 ||
    tileOccupier === TileOccupier.RealmRegularLevel2 ||
    tileOccupier === TileOccupier.RealmWonderLevel2 ||
    tileOccupier === TileOccupier.RealmRegularLevel2WonderBonus ||
    tileOccupier === TileOccupier.HyperstructureLevel2 ||
    tileOccupier === TileOccupier.RealmRegularLevel3 ||
    tileOccupier === TileOccupier.RealmWonderLevel3 ||
    tileOccupier === TileOccupier.RealmRegularLevel3WonderBonus ||
    tileOccupier === TileOccupier.HyperstructureLevel3 ||
    tileOccupier === TileOccupier.RealmRegularLevel4 ||
    tileOccupier === TileOccupier.RealmWonderLevel4 ||
    tileOccupier === TileOccupier.RealmRegularLevel4WonderBonus ||
    tileOccupier === TileOccupier.FragmentMine ||
    tileOccupier === TileOccupier.Village ||
    tileOccupier === TileOccupier.VillageWonderBonus ||
    tileOccupier === TileOccupier.Bank
  );
};

export const isTileOccupierQuest = (tileOccupier: TileOccupier) => {
  return tileOccupier === TileOccupier.Quest;
};
