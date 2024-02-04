import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import { NPARTS, COLS, START_X, START_Y, ROWS } from "./params.js";
import { getBiome } from "./getBiome.js";
import * as BIOMES from "./biomes.js";

/**
 * Generate the map and save it in a JSON file
 */
const generateAndSaveMap = () => {
  let data = []; // Array to store the data for JSON file

  let idx = 0;

  let hexRadius = 3;

  const hexHeight = hexRadius * 2;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;

  let ocean_pixels = 0;
  let sea_pixels = 0;
  let beach_pixels = 0;
  let scorched_pixels = 0;
  let bare_pixels = 0;
  let tundra_pixels = 0;
  let snow_pixels = 0;
  let temperate_desert_pixels = 0;
  let shrubland_pixels = 0;
  let taiga_pixels = 0;
  let grassland_pixels = 0;
  let temperate_deciduous_forest_pixels = 0;
  let temperate_rain_forest_pixels = 0;
  let subtropical_desert_pixels = 0;
  let tropical_seasonal_forest_pixels = 0;
  let tropical_rain_forest_pixels = 0;

  // findPart but with any nparts
  const findPartWithNParts = (col) => {
    const partSize = COLS / NPARTS;
    for (let i = 0; i < NPARTS; i++) {
      if (col < (i + 1) * partSize) {
        return i + 1;
      }
    }
  };

  // transform the col so that it starts from 0 again if you are on a new part for any nparts
  const transformColWithNParts = (col, part) => {
    const partSize = COLS / NPARTS;
    return col - Math.floor(partSize * (part - 1));
  };

  for (let row = START_Y; row < START_Y + ROWS; row++) {
    for (let col = START_X; col < START_X + COLS; col++) {
      const x = col * horizDist + ((row % 2) * horizDist) / 2;
      const y = row * vertDist;

      // calculate biome with or without parts
      let biome;
      if (NPARTS === 1) {
        biome = getBiome(col, row);
        // biome = getAdvancedBiomeWithCliffs(col, row);
        // biome = getAdvancedBiomeWithCenter(col, row);
      } else {
        const part = findPartWithNParts(col);
        const transformedCol = transformColWithNParts(col, part);
        biome = getAdvancedBiomeWithParts(transformedCol, row, part);
      }

      // calculate the number of pixels for all biomes
      if (biome.backgroundColor === BIOMES.DEEP_OCEAN.color) {
        ocean_pixels++;
      }
      if (biome.backgroundColor === BIOMES.OCEAN.color) {
        sea_pixels++;
      }
      if (biome.backgroundColor === BIOMES.BEACH.color) {
        beach_pixels++;
      }
      if (biome.backgroundColor === BIOMES.SCORCHED.color) {
        scorched_pixels++;
      }
      if (biome.backgroundColor === BIOMES.BARE.color) {
        bare_pixels++;
      }
      if (biome.backgroundColor === BIOMES.TUNDRA.color) {
        tundra_pixels++;
      }
      if (biome.backgroundColor === BIOMES.SNOW.color) {
        snow_pixels++;
      }
      if (biome.backgroundColor === BIOMES.TEMPERATE_DESERT.color) {
        temperate_desert_pixels++;
      }
      if (biome.backgroundColor === BIOMES.SHRUBLAND.color) {
        shrubland_pixels++;
      }
      if (biome.backgroundColor === BIOMES.TAIGA.color) {
        taiga_pixels++;
      }
      if (biome.backgroundColor === BIOMES.GRASSLAND.color) {
        grassland_pixels++;
      }
      if (biome.backgroundColor === BIOMES.TEMPERATE_DECIDUOUS_FOREST.color) {
        temperate_deciduous_forest_pixels++;
      }
      if (biome.backgroundColor === BIOMES.TEMPERATE_RAIN_FOREST.color) {
        temperate_rain_forest_pixels++;
      }
      if (biome.backgroundColor === BIOMES.SUBTROPICAL_DESERT.color) {
        subtropical_desert_pixels++;
      }
      if (biome.backgroundColor === BIOMES.TROPICAL_SEASONAL_FOREST.color) {
        tropical_seasonal_forest_pixels++;
      }
      if (biome.backgroundColor === BIOMES.TROPICAL_RAIN_FOREST.color) {
        tropical_rain_forest_pixels++;
      }

      // Save the data for JSON
      data.push({
        idx: idx,
        col: col,
        row: row,
        x,
        y,
        color: biome.backgroundColor, // Extract the color for this index
        depth: biome.depth,
        biome: biome.name,
      });

      idx++;
    }
  }

  console.log({ ocean_pixels });
  console.log({ sea_pixels });
  console.log({ beach_pixels });
  console.log({ scorched_pixels });
  console.log({ bare_pixels });
  console.log({ tundra_pixels });
  console.log({ snow_pixels });
  console.log({ temperate_desert_pixels });
  console.log({ shrubland_pixels });
  console.log({ taiga_pixels });
  console.log({ grassland_pixels });
  console.log({ temperate_deciduous_forest_pixels });
  console.log({ temperate_rain_forest_pixels });
  console.log({ subtropical_desert_pixels });
  console.log({ tropical_seasonal_forest_pixels });
  console.log({ tropical_rain_forest_pixels });

  const jsonData = JSON.stringify(data);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // Create a file path in the same directory as the script
  const filePath = path.join(__dirname, "hexData.json");

  // Save the JSON to a file
  fs.writeFile(filePath, jsonData, "utf8", function (err) {
    if (err) {
      console.log("An error occured while writing JSON Object to File.");
      return console.log(err);
    }
    console.log("JSON file has been saved.");
  });
};

generateAndSaveMap();
