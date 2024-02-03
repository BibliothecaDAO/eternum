import * as BIOMES from "./biomes.js";

// max size of the map
// keep u32 for now to avoid overflow
const MAX_VALUE = 4294967294;

// start of the grid
// u32/2
const START_X = MAX_VALUE / 2;
const START_Y = MAX_VALUE / 2;
// const START_X = 0;
// const START_Y = 0;

// size of the map
// const ROWS = 100;
// const COLS = 240;
const ROWS = 300;
const COLS = 500;

// divide the map into parts to be able to have 1 continent per part
// nparts = 1 => no division
const NPARTS = 1;

// modulo the elevation to go from 0.8 to 0
const CLIFF_LIMIT = 0.5;
const CLIFFS = 0.6;

// parameters to tweak
// max elevation
const MAP_AMPLITUDE = 60;
const ELEVATION_OCTAVES = [1, 0.25, 0.1];
// increase for lest detail
// decrease for more detail
// if multiple octaves
const MOISTURE_OCTAVES = [1, 0.25, 0.1];
// if only one octave
const MOISTURE_OCTAVE = 2;
const MOISTURE_SEED_NOISE = 1;

// get more island shape
// MIX = 0 === no island
// MIS = 1 === big island
const MIX = 0;

// forms of the isalnds, continents
const DEEP_OCEAN_LEVEL = 0.25;
const OCEAN_LEVEL = 0.5;

// high level biomes
const SAND_LEVEL = 0.53;
const FOREST_LEVEL = 0.6;
const DESERT_LEVEL = 0.72;
const MOUNTAIN_LEVEL = 0.8;

const determineEnvironment = (elevation, moisture) => {
  // Define biomes with their corresponding colors (hex codes) and depths
  let biome;

  if (elevation < DEEP_OCEAN_LEVEL) {
    biome = BIOMES.DEEP_OCEAN;
  } else if (elevation < OCEAN_LEVEL) {
    biome = BIOMES.OCEAN;
  } else if (elevation < SAND_LEVEL) {
    biome = BIOMES.BEACH;
  } else if (elevation > MOUNTAIN_LEVEL) {
    if (moisture < 0.1) {
      biome = BIOMES.SCORCHED;
    } else if (moisture < 0.4) {
      biome = BIOMES.BARE;
    } else if (moisture < 0.5) {
      biome = BIOMES.TUNDRA;
    } else {
      biome = BIOMES.SNOW;
    }
  } else if (elevation > DESERT_LEVEL) {
    if (moisture < 0.33) {
      biome = BIOMES.TEMPERATE_DESERT;
    } else if (moisture < 0.66) {
      biome = BIOMES.SHRUBLAND;
    } else {
      biome = BIOMES.TAIGA;
    }
  } else if (elevation > FOREST_LEVEL) {
    if (moisture < 0.16) {
      biome = BIOMES.TEMPERATE_DESERT;
    } else if (moisture < 0.5) {
      biome = BIOMES.GRASSLAND;
    } else if (moisture < 0.83) {
      biome = BIOMES.TEMPERATE_DECIDUOUS_FOREST;
    } else {
      biome = BIOMES.TEMPERATE_RAIN_FOREST;
    }
  } else {
    if (moisture < 0.16) {
      biome = BIOMES.SUBTROPICAL_DESERT;
    } else if (moisture < 0.33) {
      biome = BIOMES.GRASSLAND;
    } else if (moisture < 0.66) {
      biome = BIOMES.TROPICAL_SEASONAL_FOREST;
    } else {
      biome = BIOMES.TROPICAL_RAIN_FOREST;
    }
  }

  return { backgroundColor: biome.color, depth: biome.depth };
};

export {
  MAX_VALUE,
  START_X,
  START_Y,
  ROWS,
  COLS,
  NPARTS,
  CLIFF_LIMIT,
  CLIFFS,
  MAP_AMPLITUDE,
  ELEVATION_OCTAVES,
  MOISTURE_OCTAVES,
  MOISTURE_SEED_NOISE,
  MOISTURE_OCTAVE,
  MIX,
  DEEP_OCEAN_LEVEL,
  OCEAN_LEVEL,
  SAND_LEVEL,
  FOREST_LEVEL,
  DESERT_LEVEL,
  MOUNTAIN_LEVEL,
  determineEnvironment,
};
