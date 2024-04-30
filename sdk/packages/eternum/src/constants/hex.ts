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

// if row is odd
export const neighborOffsetsOdd = [
  { i: 1, j: 0, direction: 0 },
  { i: 0, j: 1, direction: 1 },
  { i: -1, j: 1, direction: 2 },
  { i: -1, j: 0, direction: 3 },
  { i: -1, j: -1, direction: 4 },
  { i: 0, j: -1, direction: 5 },
];

// if row is even
export const neighborOffsetsEven = [
  { i: 1, j: 0, direction: 0 },
  { i: 1, j: 1, direction: 1 },
  { i: 0, j: 1, direction: 2 },
  { i: -1, j: 0, direction: 3 },
  { i: 0, j: -1, direction: 4 },
  { i: 1, j: -1, direction: 5 },
];
