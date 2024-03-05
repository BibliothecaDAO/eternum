// colors and depth
// const DEEP_OCEAN = { color: "#000080", depth: 0.1 }; // Deep Blue
// const OCEAN = { color: "#0000FF", depth: 0.1 }; // Deep Blue
// const BEACH = { color: "#F5DEB3", depth: 0.2 }; // Sandy Beige
// const SCORCHED = { color: "#555555", depth: 0.8 }; // Dark Gray
// const BARE = { color: "#BCB6B6", depth: 0.7 }; // Light Gray
// const TUNDRA = { color: "#ACE5EE", depth: 0.6 }; // Frost Blue
// const SNOW = { color: "#FFFFFF", depth: 0.5 }; // White
// const TEMPERATE_DESERT = { color: "#C2B280", depth: 0.4 }; // Desert Sand
// const SHRUBLAND = { color: "#708238", depth: 0.5 }; // Olive Green
// const TAIGA = { color: "#004000", depth: 0.6 }; // Dark Green
// const GRASSLAND = { color: "#7CFC00", depth: 0.4 }; // Grass Green
// const TEMPERATE_DECIDUOUS_FOREST = { color: "#228B22", depth: 0.5 }; // Forest Green
// const TEMPERATE_RAIN_FOREST = { color: "#013220", depth: 0.7 }; // Dark Emerald
// const SUBTROPICAL_DESERT = { color: "#F0E68C", depth: 0.3 }; // Pale Yellow
// const TROPICAL_SEASONAL_FOREST = { color: "#32CD32", depth: 0.5 }; // Lime Green
// const TROPICAL_RAIN_FOREST = { color: "#006400", depth: 0.6 }; // Deep Jungle Green
const DEEP_OCEAN = { color: "#293A5D", depth: 0.1, name: "deep_ocean" }; // Deep Navy Blue
const OCEAN = { color: "#2E3F63", depth: 0.1, name: "ocean" }; // Bright Sky Blue
const BEACH = { color: "#937B57", depth: 0.2, name: "beach" }; // Sandy Beige
const SCORCHED = { color: "#8B4513", depth: 0.8, name: "scorched" }; // Saddle Brown
const BARE = { color: "#A8A8A8", depth: 0.7, name: "bare" }; // Cool Grey
const TUNDRA = { color: "#B4C7D9", depth: 0.6, name: "tundra" }; // Ice Blue
const SNOW = { color: "#FFFFFF", depth: 0.5, name: "snow" }; // Pure White
const TEMPERATE_DESERT = { color: "#E3BC9A", depth: 0.4, name: "temperate_desert" }; // Pale Desert Sand
const SHRUBLAND = { color: "#A89254", depth: 0.5, name: "shrubland" }; // Muted Olive Green
const TAIGA = { color: "#3A3F23", depth: 0.6, name: "taiga" }; // Pine Green
const GRASSLAND = { color: "#404526", depth: 0.4, name: "grassland" }; // Fresh Grass Green
const TEMPERATE_DECIDUOUS_FOREST = { color: "#688E34", depth: 0.5, name: "temperate_deciduous_forest" }; // Forest Green
const TEMPERATE_RAIN_FOREST = { color: "#688E34", depth: 0.7, name: "temperate_rain_forest" }; // Deep Jungle Green
const SUBTROPICAL_DESERT = { color: "#BFA983", depth: 0.3, name: "subtropical_desert" }; // Tan
const TROPICAL_SEASONAL_FOREST = { color: "#78803E", depth: 0.5, name: "tropical_seasonal_forest" }; // Lush Leaf Green
const TROPICAL_RAIN_FOREST = { color: "#2F3E1B", depth: 0.6, name: "tropical_rain_forest" }; // Rainforest Green

export const biomes = {
  deep_ocean: { color: "#3a5f65", depth: 0.1, name: "deep_ocean" },
  ocean: { color: "#62a68f", depth: 0.1, name: "ocean" },
  beach: { color: "#ffe079", depth: 0.2, name: "beach" },
  scorched: { color: "#8B4513", depth: 0.8, name: "scorched" },
  bare: { color: "#A8A8A8", depth: 0.7, name: "bare" },
  tundra: { color: "#B4C7D9", depth: 0.6, name: "tundra" },
  snow: { color: "#FFFFFF", depth: 0.5, name: "snow" },
  temperate_desert: { color: "#f3c959", depth: 0.4, name: "temperate_desert" },
  shrubland: { color: "#b3ab3e", depth: 0.5, name: "shrubland" },
  taiga: { color: "#615b27", depth: 0.6, name: "taiga" },
  grassland: { color: "#6b8228", depth: 0.4, name: "grassland" },
  temperate_deciduous_forest: { color: "#57641f", depth: 0.5, name: "temperate_deciduous_forest" },
  temperate_rain_forest: { color: "#5a6322", depth: 0.7, name: "temperate_rain_forest" },
  subtropical_desert: { color: "#b2ac3a", depth: 0.3, name: "subtropical_desert" },
  tropical_seasonal_forest: { color: "#596823", depth: 0.5, name: "tropical_seasonal_forest" },
  tropical_rain_forest: { color: "#4f6123", depth: 0.6, name: "tropical_rain_forest" },
};

// bmd

// export const biomes = {
//   deep_ocean: { color: "#293A5D", depth: 0.1, name: "deep_ocean" },
//   ocean: { color: "#2E3F63", depth: 0.1, name: "ocean" },
//   beach: { color: "#937B57", depth: 0.2, name: "beach" },
//   scorched: { color: "#8B4513", depth: 0.8, name: "scorched" },
//   bare: { color: "#A8A8A8", depth: 0.7, name: "bare" },
//   tundra: { color: "#B4C7D9", depth: 0.6, name: "tundra" },
//   snow: { color: "#FFFFFF", depth: 0.5, name: "snow" },
//   temperate_desert: { color: "#E3BC9A", depth: 0.4, name: "temperate_desert" },
//   shrubland: { color: "#A89254", depth: 0.5, name: "shrubland" },
//   taiga: { color: "#3A3F23", depth: 0.6, name: "taiga" },
//   grassland: { color: "#404526", depth: 0.4, name: "grassland" },
//   temperate_deciduous_forest: { color: "#688E34", depth: 0.5, name: "temperate_deciduous_forest" },
//   temperate_rain_forest: { color: "#325D36", depth: 0.7, name: "temperate_rain_forest" },
//   subtropical_desert: { color: "#BFA983", depth: 0.3, name: "subtropical_desert" },
//   tropical_seasonal_forest: { color: "#78803E", depth: 0.5, name: "tropical_seasonal_forest" },
//   tropical_rain_forest: { color: "#2F3E1B", depth: 0.6, name: "tropical_rain_forest" },
// };
