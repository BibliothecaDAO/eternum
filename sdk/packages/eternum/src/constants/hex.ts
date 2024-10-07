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

export enum Direction {
  EAST,
  NORTH_EAST,
  NORTH_WEST,
  WEST,
  SOUTH_WEST,
  SOUTH_EAST,
}

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

export const getNeighborHexes = (col: number, row: number) => {
  const offsets = getNeighborOffsets(row);
  return offsets.map((offset) => ({
    col: col + offset.i,
    row: row + offset.j,
    direction: offset.direction,
  }));
};

export const getNeighborOffsets = (row: number) => {
  return row % 2 === 0 ? NEIGHBOR_OFFSETS_EVEN : NEIGHBOR_OFFSETS_ODD;
};

export const getDirectionBetweenAdjacentHexes = (
  from: { col: number; row: number },
  to: { col: number; row: number },
): Direction | null => {
  const neighbors = getNeighborHexes(from.col, from.row);
  return neighbors.find((n) => n.col === to.col && n.row === to.row)?.direction ?? null;
};
