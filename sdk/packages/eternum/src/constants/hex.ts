export const biomes = {
  deep_ocean: { color: "#003366", depth: 0.1, name: "deep_ocean" },
  ocean: { color: "#0099CC", depth: 0.1, name: "ocean" },
  beach: { color: "#C2B280", depth: 0.2, name: "beach" },
  scorched: { color: "#8B4513", depth: 0.8, name: "scorched" },
  bare: { color: "#A8A8A8", depth: 0.7, name: "bare" },
  tundra: { color: "#B4C7D9", depth: 0.6, name: "tundra" },
  snow: { color: "#FFFFFF", depth: 0.5, name: "snow" },
  temperate_desert: { color: "#E3BC9A", depth: 0.4, name: "temperate_desert" },
  shrubland: { color: "#88A95B", depth: 0.5, name: "shrubland" },
  taiga: { color: "#3B4D3D", depth: 0.6, name: "taiga" },
  grassland: { color: "#7BB661", depth: 0.4, name: "grassland" },
  temperate_deciduous_forest: { color: "#688E34", depth: 0.5, name: "temperate_deciduous_forest" },
  temperate_rain_forest: { color: "#325D36", depth: 0.7, name: "temperate_rain_forest" },
  subtropical_desert: { color: "#D2B48C", depth: 0.3, name: "subtropical_desert" },
  tropical_seasonal_forest: { color: "#6A8035", depth: 0.5, name: "tropical_seasonal_forest" },
  tropical_rain_forest: { color: "#005824", depth: 0.6, name: "tropical_rain_forest" },
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
