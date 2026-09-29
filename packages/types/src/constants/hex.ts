export const ETHEREAL_STRIDE = 15;

export enum BiomeType {
  None = "None",
  Underground = "Underground",
  DeepOcean = "DeepOcean",
  Ocean = "Ocean",
  Beach = "Beach",
  Scorched = "Scorched",
  Bare = "Bare",
  Tundra = "Tundra",
  Snow = "Snow",
  TemperateDesert = "TemperateDesert",
  Shrubland = "Shrubland",
  Taiga = "Taiga",
  Grassland = "Grassland",
  TemperateDeciduousForest = "TemperateDeciduousForest",
  TemperateRainForest = "TemperateRainForest",
  SubtropicalDesert = "SubtropicalDesert",
  TropicalSeasonalForest = "TropicalSeasonalForest",
  TropicalRainForest = "TropicalRainForest",
}

// Mapping from BiomeType to numeric ID (matching Cairo contract values)
export const BiomeTypeToId: Record<BiomeType, number> = {
  [BiomeType.None]: 0,
  [BiomeType.Underground]: 17,
  [BiomeType.DeepOcean]: 1,
  [BiomeType.Ocean]: 2,
  [BiomeType.Beach]: 3,
  [BiomeType.Scorched]: 4,
  [BiomeType.Bare]: 5,
  [BiomeType.Tundra]: 6,
  [BiomeType.Snow]: 7,
  [BiomeType.TemperateDesert]: 8,
  [BiomeType.Shrubland]: 9,
  [BiomeType.Taiga]: 10,
  [BiomeType.Grassland]: 11,
  [BiomeType.TemperateDeciduousForest]: 12,
  [BiomeType.TemperateRainForest]: 13,
  [BiomeType.SubtropicalDesert]: 14,
  [BiomeType.TropicalSeasonalForest]: 15,
  [BiomeType.TropicalRainForest]: 16,
};

// Mapping from numeric ID to BiomeType
export const BiomeIdToType: Record<number, BiomeType> = Object.entries(BiomeTypeToId).reduce(
  (acc, [type, id]) => ({
    ...acc,
    [id]: type as BiomeType,
  }),
  {} as Record<number, BiomeType>,
);

export enum Direction {
  EAST,
  NORTH_EAST,
  NORTH_WEST,
  WEST,
  SOUTH_WEST,
  SOUTH_EAST,
}

// if row is even
const NEIGHBOR_OFFSETS_EVEN = [
  { i: 1, j: 0, direction: Direction.EAST },
  { i: 1, j: 1, direction: Direction.NORTH_EAST },
  { i: 0, j: 1, direction: Direction.NORTH_WEST },
  { i: -1, j: 0, direction: Direction.WEST },
  { i: 0, j: -1, direction: Direction.SOUTH_WEST },
  { i: 1, j: -1, direction: Direction.SOUTH_EAST },
];

// if row is odd
const NEIGHBOR_OFFSETS_ODD = [
  { i: 1, j: 0, direction: Direction.EAST },
  { i: 0, j: 1, direction: Direction.NORTH_EAST },
  { i: -1, j: 1, direction: Direction.NORTH_WEST },
  { i: -1, j: 0, direction: Direction.WEST },
  { i: -1, j: -1, direction: Direction.SOUTH_WEST },
  { i: 0, j: -1, direction: Direction.SOUTH_EAST },
];

enum Steps {
  One = 1,
  Two = 2,
}

export type NeighborHex = {
  col: number;
  row: number;
  direction: Direction;
};

export const getNeighborHexes = (col: number, row: number, steps: Steps = Steps.One): NeighborHex[] => {
  if (steps === Steps.One) {
    const offsets = getNeighborOffsets(row);
    return offsets.map((offset) => ({
      col: col + offset.i,
      row: row + offset.j,
      direction: offset.direction,
    }));
  } else if (steps === 2) {
    const offsets = getNeighborOffsets(row);
    return offsets.map((offset) => {
      // Get first step coordinates
      const firstStepCol = col + offset.i;
      const firstStepRow = row + offset.j;

      // Get offsets for the second step based on the first step's row
      const secondStepOffsets = getNeighborOffsets(firstStepRow);
      const secondStepOffset = secondStepOffsets[offset.direction];

      return {
        col: firstStepCol + secondStepOffset.i,
        row: firstStepRow + secondStepOffset.j,
        direction: offset.direction,
      };
    });
  } else {
    // For steps > 2, recursively apply the function
    let result = getNeighborHexes(col, row, Steps.One);
    for (let i = 1; i < steps; i++) {
      result = result.map((hex) => {
        const nextStep = getNeighborHexes(hex.col, hex.row, Steps.One).find((n) => n.direction === hex.direction);
        return nextStep ? nextStep : hex;
      });
    }
    return result;
  }
};

/** Matches Coord.neighbor: scale the row's offsets, without walking intermediate rows. */
export function getLayerNeighborHexes(col: number, row: number, alt: boolean): NeighborHex[] {
  const stride = alt ? ETHEREAL_STRIDE : 1;
  return getNeighborOffsets(row).map(({ i, j, direction }) => ({
    col: col + i * stride,
    row: row + j * stride,
    direction,
  }));
}

export const getHexesWithinRadius = (col: number, row: number, radius: number): NeighborHex[] => {
  if (radius <= 0) return [];

  const visited = new Set<string>([`${col},${row}`]);
  const hexes: NeighborHex[] = [];
  let frontier = [{ col, row, direction: Direction.EAST }];

  for (let distance = 1; distance <= radius; distance++) {
    const nextFrontier: NeighborHex[] = [];

    for (const hex of frontier) {
      for (const neighbor of getNeighborHexes(hex.col, hex.row)) {
        const key = `${neighbor.col},${neighbor.row}`;
        if (visited.has(key)) continue;

        visited.add(key);
        hexes.push(neighbor);
        nextFrontier.push(neighbor);
      }
    }

    frontier = nextFrontier;
  }

  return hexes;
};

export const getHexDistance = (
  from: { col: number; row: number },
  to: { col: number; row: number },
  maxRadius = 64,
): number => {
  if (from.col === to.col && from.row === to.row) return 0;

  // Even rows are offset east. Axial coordinates give the exact cube distance.
  const columnDelta = to.col - Math.ceil(to.row / 2) - (from.col - Math.ceil(from.row / 2));
  const rowDelta = to.row - from.row;
  const distance = Math.max(Math.abs(columnDelta), Math.abs(rowDelta), Math.abs(columnDelta + rowDelta));
  return distance <= maxRadius ? distance : Infinity;
};

export const getNeighborOffsets = (row: number) => {
  return row % 2 === 0 ? NEIGHBOR_OFFSETS_EVEN : NEIGHBOR_OFFSETS_ODD;
};

export const getDirectionBetweenAdjacentHexes = (
  from: { col: number; row: number },
  to: { col: number; row: number },
): Direction | null => {
  const neighbors = getNeighborHexes(from.col, from.row, Steps.One);
  return neighbors.find((n) => n.col === to.col && n.row === to.row)?.direction ?? null;
};

/** Attack distance uses movement steps; cross-layer attacks require the same coordinate. */
export function getLayeredAttackDistance(
  attacker: { col: number; row: number; alt: boolean },
  defender: { col: number; row: number; alt: boolean },
): number {
  const distance = getHexDistance(attacker, defender);
  if (attacker.alt !== defender.alt) return distance === 0 ? 1 : Infinity;
  return distance / (defender.alt ? ETHEREAL_STRIDE : 1);
}
