export const biomes = {
  deep_ocean: { color: "#3a5f65", depth: 0.1, name: "Deep Ocean" },
  ocean: { color: "#62a68f", depth: 0.1, name: "Ocean" },
  beach: { color: "#ffe079", depth: 0.2, name: "Beach" },
  scorched: { color: "#8B4513", depth: 0.8, name: "Scorched" },
  bare: { color: "#A8A8A8", depth: 0.7, name: "Bare" },
  tundra: { color: "#B4C7D9", depth: 0.6, name: "Tundra" },
  snow: { color: "#FFFFFF", depth: 0.5, name: "Snow" },
  temperate_desert: { color: "#f3c959", depth: 0.4, name: "Temperate Desert" },
  shrubland: { color: "#b3ab3e", depth: 0.5, name: "Shrubland" },
  taiga: { color: "#615b27", depth: 0.6, name: "Taiga" },
  grassland: { color: "#6b8228", depth: 0.4, name: "Grassland" },
  temperate_deciduous_forest: { color: "#57641f", depth: 0.5, name: "Temperate Deciduous Forest" },
  temperate_rain_forest: { color: "#5a6322", depth: 0.7, name: "Temperate Rain Forest" },
  subtropical_desert: { color: "#b2ac3a", depth: 0.3, name: "Subtropical Desert" },
  tropical_seasonal_forest: { color: "#596823", depth: 0.5, name: "Tropical Seasonal Forest" },
  tropical_rain_forest: { color: "#4f6123", depth: 0.6, name: "Tropical Rain Forest" },
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
