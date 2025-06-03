export const biomes = {
  deep_ocean: { color: "#193E60", depth: 0.1, name: "Deep Ocean" },
  ocean: { color: "#1A6C87", depth: 0.1, name: "Ocean" },
  beach: { color: "#776444", depth: 0.2, name: "Beach" },
  scorched: { color: "#554538", depth: 0.8, name: "Scorched" },
  bare: { color: "#7E6E4F", depth: 0.7, name: "Bare" },
  tundra: { color: "#7E6A59", depth: 0.6, name: "Tundra" },
  snow: { color: "#827F6A", depth: 0.5, name: "Snow" },
  temperate_desert: { color: "#95552C", depth: 0.4, name: "Temperate Desert" },
  shrubland: { color: "#B29356", depth: 0.5, name: "Shrubland" },
  taiga: { color: "#5B4F36", depth: 0.6, name: "Taiga" },
  grassland: { color: "#5B533D", depth: 0.4, name: "Grassland" },
  temperate_deciduous_forest: { color: "#685E45", depth: 0.5, name: "Temperate Deciduous Forest" },
  temperate_rain_forest: { color: "#685037", depth: 0.7, name: "Temperate Rain Forest" },
  subtropical_desert: { color: "#7F694A", depth: 0.3, name: "Subtropical Desert" },
  tropical_seasonal_forest: { color: "#675138", depth: 0.5, name: "Tropical Seasonal Forest" },
  tropical_rain_forest: { color: "#6B4927", depth: 0.6, name: "Tropical Rain Forest" },
};

export enum BiomeType {
  None = "None",
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

export const DirectionName: Record<Direction, string> = {
  [Direction.EAST]: "East",
  [Direction.NORTH_EAST]: "North East",
  [Direction.NORTH_WEST]: "North West",
  [Direction.WEST]: "West",
  [Direction.SOUTH_WEST]: "South West",
  [Direction.SOUTH_EAST]: "South East",
};

// if row is even
export const NEIGHBOR_OFFSETS_EVEN = [
  { i: 1, j: 0, direction: Direction.EAST },
  { i: 1, j: 1, direction: Direction.NORTH_EAST },
  { i: 0, j: 1, direction: Direction.NORTH_WEST },
  { i: -1, j: 0, direction: Direction.WEST },
  { i: 0, j: -1, direction: Direction.SOUTH_WEST },
  { i: 1, j: -1, direction: Direction.SOUTH_EAST },
];

// if row is odd
export const NEIGHBOR_OFFSETS_ODD = [
  { i: 1, j: 0, direction: Direction.EAST },
  { i: 0, j: 1, direction: Direction.NORTH_EAST },
  { i: -1, j: 1, direction: Direction.NORTH_WEST },
  { i: -1, j: 0, direction: Direction.WEST },
  { i: -1, j: -1, direction: Direction.SOUTH_WEST },
  { i: 0, j: -1, direction: Direction.SOUTH_EAST },
];

export enum Steps {
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
