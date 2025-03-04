/**
 * Hexagonal coordinate system implementation
 * Based on https://www.redblobgames.com/grids/hexagons/
 */

// HexDirection enum for hex grid navigation
export enum HexDirection {
    East = 'East',
    NorthEast = 'NorthEast',
    NorthWest = 'NorthWest',
    West = 'West',
    SouthWest = 'SouthWest',
    SouthEast = 'SouthEast'
  }
  
  // Helper function to get all directions
  export function getAllHexDirections(): HexDirection[] {
    return [
      HexDirection.East,
      HexDirection.NorthEast,
      HexDirection.NorthWest,
      HexDirection.West,
      HexDirection.SouthWest,
      HexDirection.SouthEast
    ];
  }
  
  /**
   * Represents a cube coordinate in a hex grid
   */
  export class Cube {
    constructor(
      public q: number,
      public r: number,
      public s: number
    ) {}
  
    static zero(): Cube {
      return new Cube(0, 0, 0);
    }
  
    subtract(other: Cube): Cube {
      return new Cube(
        this.q - other.q,
        this.r - other.r,
        this.s - other.s
      );
    }
  
    abs(): Cube {
      return new Cube(
        Math.abs(this.q),
        Math.abs(this.r),
        Math.abs(this.s)
      );
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
      public y: number
    ) {}
  
    toString(): string {
      return `Coord (x:${this.x}, y:${this.y})`;
    }
  
    neighbor(direction: HexDirection): Coord {
      // https://www.redblobgames.com/grids/hexagons/#neighbors-offset
      if (this.y % 2 === 0) {
        // Where y (row) is even
        switch (direction) {
          case HexDirection.East:
            return new Coord(this.x + 1, this.y);
          case HexDirection.NorthEast:
            return new Coord(this.x + 1, this.y + 1);
          case HexDirection.NorthWest:
            return new Coord(this.x, this.y + 1);
          case HexDirection.West:
            return new Coord(this.x - 1, this.y);
          case HexDirection.SouthWest:
            return new Coord(this.x, this.y - 1);
          case HexDirection.SouthEast:
            return new Coord(this.x + 1, this.y - 1);
        }
      } else {
        // Where y (row) is odd
        switch (direction) {
          case HexDirection.East:
            return new Coord(this.x + 1, this.y);
          case HexDirection.NorthEast:
            return new Coord(this.x, this.y + 1);
          case HexDirection.NorthWest:
            return new Coord(this.x - 1, this.y + 1);
          case HexDirection.West:
            return new Coord(this.x - 1, this.y);
          case HexDirection.SouthWest:
            return new Coord(this.x - 1, this.y - 1);
          case HexDirection.SouthEast:
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
    travel(direction: HexDirection, steps: number): Coord {
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
    static findHexCoordsfromCenter(steps: number): Record<HexDirection, Coord> {
      const center = new Coord(HexGrid.CENTER, HexGrid.CENTER);
      const result: Partial<Record<HexDirection, Coord>> = {};
      
      getAllHexDirections().forEach(direction => {
        result[direction] = center.travel(direction, steps);
      });
      
      return result as Record<HexDirection, Coord>;
    }
  }
  
  // Example usage 1:
  // const coord1 = new Coord(10, 5);
  // const coord2 = new Coord(15, 8);
  // const distance = coord1.distance(coord2) * HexGrid.HEX_DISTANCE_TO_KM;
  // console.log(`Distance: ${distance} km`);
  // console.log(`Travel time: ${HexGrid.travelTime(coord1, coord2, 30)} seconds`);
  

  // Example usage 2:
  // Find coordinates 50 steps from center in each direction
//   const stepsFromCenter = 50;
//   const distantCoordinates = HexGrid.findHexCoordsfromCenter(stepsFromCenter);
  
//   console.log(`Coordinates ${stepsFromCenter} steps from center:`);
//   for (const [direction, coord] of Object.entries(distantCoordinates)) {
//     console.log(`${direction}: ${coord.toString()}`);
//   }