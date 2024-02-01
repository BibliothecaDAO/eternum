import { snoise } from "@dojoengine/utils";
import * as fs from "fs";
import * as math from "mathjs";

// max size of the map
const MAX_VALUE = 4294967294;

// start of the grid
// u32/2
// const START_X = MAX_VALUE / 2;
// const START_Y = MAX_VALUE / 2;
const START_X = 0;
const START_Y = 0;

// size of the map
const ROWS = 100;
const COLS = 240;

// divide the map into parts to be able to have 1 continent per part
// nparts = 1 => no division
const NPARTS = 1;

// parameters to tweak
// max elevation
const MAP_AMPLITUDE = 13;

// get more island shape
// MIX = 0 === no island
// MIS = 1 === big island
const MIX = 0;

// forms of the isalnds, continents
const OCEAN_LEVEL = 0.45;

// high level biomes
const SAND_LEVEL = 0.5;
const FOREST_LEVEL = 0.55;
const DESERT_LEVEL = 0.7;
const MOUNTAIN_LEVEL = 0.8;

// colors and depth
const OCEAN = { color: "#0000FF", depth: 0.1 }; // Deep Blue
const BEACH = { color: "#F5DEB3", depth: 0.2 }; // Sandy Beige
const SCORCHED = { color: "#555555", depth: 0.8 }; // Dark Gray
const BARE = { color: "#BCB6B6", depth: 0.7 }; // Light Gray
const TUNDRA = { color: "#ACE5EE", depth: 0.6 }; // Frost Blue
const SNOW = { color: "#FFFFFF", depth: 0.5 }; // White
const TEMPERATE_DESERT = { color: "#C2B280", depth: 0.4 }; // Desert Sand
const SHRUBLAND = { color: "#708238", depth: 0.5 }; // Olive Green
const TAIGA = { color: "#004000", depth: 0.6 }; // Dark Green
const GRASSLAND = { color: "#7CFC00", depth: 0.4 }; // Grass Green
const TEMPERATE_DECIDUOUS_FOREST = { color: "#228B22", depth: 0.5 }; // Forest Green
const TEMPERATE_RAIN_FOREST = { color: "#013220", depth: 0.7 }; // Dark Emerald
const SUBTROPICAL_DESERT = { color: "#F0E68C", depth: 0.3 }; // Pale Yellow
const TROPICAL_SEASONAL_FOREST = { color: "#32CD32", depth: 0.5 }; // Lime Green
const TROPICAL_RAIN_FOREST = { color: "#006400", depth: 0.6 }; // Deep Jungle Green

class SeededRandom {
  constructor(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  // Basic pseudo-random number generator
  nextInt(min, max) {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    const rnd = this.seed / 233280;
    return Math.floor(min + rnd * (max - min));
  }
}

const lerp = (start, end, amt) => {
  return (1 - amt) * start + amt * end;
};

// Function to generate a permutation table based on a seed
const generatePermutationTable = (seed) => {
  let perm = Array.from({ length: 289 }, (_, i) => i); // Array of 289 elements
  let random = new SeededRandom(seed);

  // Shuffle the array using the seeded random number generator
  for (let i = perm.length - 1; i > 0; i--) {
    let j = random.nextInt(0, i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }

  return perm;
};

const permuteWithSeed = (x, seed) => {
  const permTable = generatePermutationTable(seed);

  return x.map((v) => permTable[Math.floor(v) % permTable.length]);
};

const multiply = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return math.multiply(a, b);
  return a.map((v, i) => v * b[i]);
};

const floor = (a) => {
  return a.map((v) => Math.floor(v));
};

const step = (a, b) => {
  return a.map((v, i) => (b[i] <= v ? 0 : 1));
};

const taylorInvSqrt = (r) => {
  return r.map((v) => 1.79284291400159 - 0.85373472095314 * v);
};

// custom implementation of snoise to use a different seed
// same as the snoise but with seed
export const seedsnoise = (v, seed) => {
  const C = [1.0 / 6.0, 1.0 / 3.0];
  const D = [0.0, 0.5, 1.0, 2.0];

  // First corner
  let i = floor(math.add(v, math.dot(v, [C[1], C[1], C[1]])));
  let x0 = math.add(math.subtract(v, i), math.dot(i, [C[0], C[0], C[0]]));

  // Other corners
  let g = step([x0[1], x0[2], x0[0]], [x0[0], x0[1], x0[2]]);
  let l = math.subtract(1.0, g);
  let i1 = math.min(
    [
      [g[0], g[1], g[2]],
      [l[2], l[0], l[1]],
    ],
    0,
  );
  let i2 = math.max(
    [
      [g[0], g[1], g[2]],
      [l[2], l[0], l[1]],
    ],
    0,
  );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  let x1 = math.add(math.subtract(x0, i1), [C[0], C[0], C[0]]);
  let x2 = math.add(math.subtract(x0, i2), [C[1], C[1], C[1]]); // 2.0*C.x = 1/3 = C.y
  let x3 = math.subtract(x0, [D[1], D[1], D[1]]); // -1.0+3.0*C.x = -0.5 = -D.y

  // Permutations
  // let p1 = permute(math.add(i[2], [0.0, i1[2], i2[2], 1.0]));
  // let p2 = permute(math.add(math.add(p1, i[1]), [0.0, i1[1], i2[1], 1.0]));
  // let p = permute(math.add(math.add(p2, i[0]), [0.0, i1[0], i2[0], 1.0]));
  // permute with seed
  let p1 = permuteWithSeed(math.add(i[2], [0.0, i1[2], i2[2], 1.0]), seed);
  let p2 = permuteWithSeed(math.add(math.add(p1, i[1]), [0.0, i1[1], i2[1], 1.0]), seed);
  let p = permuteWithSeed(math.add(math.add(p2, i[0]), [0.0, i1[0], i2[0], 1.0]), seed);

  // Gradients: 7x7 points over a square, mapped onto an octahedron.
  // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  let ns = [0.285714285714286, -0.928571428571428, 0.142857142857143]; // these must be *exact*
  let j = math.subtract(p, multiply(49, floor(multiply(p, ns[2] * ns[2])))); //  mod(p,7*7)

  let x_ = floor(multiply(j, ns[2]));
  let y_ = floor(math.subtract(j, multiply(7, x_))); // mod(j,N)

  let x = math.add(multiply(x_, ns[0]), [ns[1], ns[1], ns[1], ns[1]]);
  let y = math.add(multiply(y_, ns[0]), [ns[1], ns[1], ns[1], ns[1]]);
  let h = math.subtract(math.subtract(1.0, math.abs(x)), math.abs(y));

  let b0 = [x[0], x[1], y[0], y[1]];
  let b1 = [x[2], x[3], y[2], y[3]];
  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  let s0 = math.add(multiply(floor(b0), 2.0), 1.0);
  let s1 = math.add(multiply(floor(b1), 2.0), 1.0);
  let sh = multiply(-1, step(h, [0, 0, 0, 0]));

  let a0 = math.add([b0[0], b0[2], b0[1], b0[3]], multiply([s0[0], s0[2], s0[1], s0[3]], [sh[0], sh[0], sh[1], sh[1]]));
  let a1 = math.add([b1[0], b1[2], b1[1], b1[3]], multiply([s1[0], s1[2], s1[1], s1[3]], [sh[2], sh[2], sh[3], sh[3]]));

  let p0 = [a0[0], a0[1], h[0]];
  p1 = [a0[2], a0[3], h[1]];
  p2 = [a1[0], a1[1], h[2]];
  let p3 = [a1[2], a1[3], h[3]];

  // Normalise gradients
  let norm = taylorInvSqrt([math.dot(p0, p0), math.dot(p1, p1), math.dot(p2, p2), math.dot(p3, p3)]);
  p0 = multiply(p0, norm[0]);
  p1 = multiply(p1, norm[1]);
  p2 = multiply(p2, norm[2]);
  p3 = multiply(p3, norm[3]);

  // Mix final noise value
  //@ts-ignore
  let m = math.max(
    [
      //@ts-ignore
      math.subtract(0.5, [math.dot(x0, x0), math.dot(x1, x1), math.dot(x2, x2), math.dot(x3, x3)]),
      [0, 0, 0, 0],
    ],
    0,
  );
  m = multiply(m, m);
  m = multiply(m, m);
  let noise = multiply(
    105.0,
    //@ts-ignore
    math.dot(m, [math.dot(p0, x0), math.dot(p1, x1), math.dot(p2, x2), math.dot(p3, x3)]),
  );
  return noise;
};

const determineEnvironment = (elevation, moisture) => {
  // Define biomes with their corresponding colors (hex codes) and depths
  let biome;

  // 0.1
  if (elevation < OCEAN_LEVEL) {
    biome = OCEAN;
    // 0.12
  } else if (elevation < SAND_LEVEL) {
    biome = BEACH;
  } else if (elevation > MOUNTAIN_LEVEL) {
    if (moisture < 0.1) {
      biome = SCORCHED;
    } else if (moisture < 0.2) {
      biome = BARE;
    } else if (moisture < 0.5) {
      biome = TUNDRA;
    } else {
      biome = SNOW;
    }
  } else if (elevation > DESERT_LEVEL) {
    if (moisture < 0.33) {
      biome = TEMPERATE_DESERT;
    } else if (moisture < 0.66) {
      biome = SHRUBLAND;
    } else {
      biome = TAIGA;
    }
  } else if (elevation > FOREST_LEVEL) {
    if (moisture < 0.16) {
      biome = TEMPERATE_DESERT;
    } else if (moisture < 0.5) {
      biome = GRASSLAND;
    } else if (moisture < 0.83) {
      biome = TEMPERATE_DECIDUOUS_FOREST;
    } else {
      biome = TEMPERATE_RAIN_FOREST;
    }
  } else {
    if (moisture < 0.16) {
      biome = SUBTROPICAL_DESERT;
    } else if (moisture < 0.33) {
      biome = GRASSLAND;
    } else if (moisture < 0.66) {
      biome = TROPICAL_SEASONAL_FOREST;
    } else {
      biome = TROPICAL_RAIN_FOREST;
    }
  }

  return { backgroundColor: biome.color, depth: biome.depth };
};

// get the noise
// get the center of the map to allow islands
export const getAdvancedBiome = (col, row) => {
  const elevation = Math.floor(((snoise([col / MAP_AMPLITUDE, 0, row / MAP_AMPLITUDE]) + 1) / 2) * 100);
  const moisture = Math.floor(((snoise([col / MAP_AMPLITUDE / 2, 0, row / MAP_AMPLITUDE / 2]) + 1) / 2) * 100);

  // ISLANDS
  // determine the distance between col, row and the center of the map
  const center = [COLS / 2, ROWS / 2];
  const distance = Math.sqrt(Math.pow(col - center[0], 2) + Math.pow(row - center[1], 2));
  // range from -1 to 1
  const distanceFactor = (distance / Math.sqrt(Math.pow(center[0], 2) + Math.pow(center[1], 2))) * 2 - 1;
  // new elevation based on this forumula e = lerp(e, 1-d, mix)
  const newElevation = lerp(elevation / 100, 1 - distanceFactor, MIX);

  return determineEnvironment(newElevation, moisture / 100);
};

// create 1 map per continent and concatenate them together afterwards (1 part = 1 continent)
export const getAdvancedBiomeWithParts = (col, row, part) => {
  // use snoise with seed
  const elevation = Math.floor(((seedsnoise([col / MAP_AMPLITUDE, 0, row / MAP_AMPLITUDE], part) + 1) / 2) * 100);
  const moisture = Math.floor(((seedsnoise([col / MAP_AMPLITUDE, 0, row / MAP_AMPLITUDE]) + 1) / 2) * 100);

  // determine the distance between col, row and the center of the map
  const center = [COLS / (NPARTS * 2), ROWS / 2];

  // modify a bit the centers of the continents to add more variability
  // MANUALLY
  // put center a bit on the right if part is 1
  // put center a bit on bottom if part is 2
  // put center a bit on the left if part is 3
  // do this randomly with part as the seed to have the same result for each part
  // if (part === 1) {
  //   center[0] = center[0] * 1.3;
  //   center[1] = center[0] * 0.8;
  // } else if (part === 2) {
  //   center[1] = center[1] * 1.3;
  // } else {
  //   center[0] = center[0] * 0.5;
  // }

  // randomly with seed
  const seed1 = new SeededRandom(part);
  const random1 = seed1.nextInt(70, 130) / 100;
  const seed2 = new SeededRandom(part ** 2);
  const random2 = seed2.nextInt(70, 130) / 100;
  center[0] = center[0] * random1;
  center[1] = center[1] * random2;

  const distance = Math.sqrt(Math.pow(col - center[0], 2) + Math.pow(row - center[1], 2));
  // range from -1 to 1
  const distanceFactor = (distance / Math.sqrt(Math.pow(center[0], 2) + Math.pow(center[1], 2))) * 2 - 1;
  // new elevation based on this forumula e = lerp(e, 1-d, mix)
  const newElevation = lerp(elevation / 100, 1 - distanceFactor, MIX);

  return determineEnvironment(newElevation, moisture / 100);
};

/**
 * Generate the map and save it in a JSON file
 * @param {number} nparts divide the map into nparts to be able to represent 1 continent per part
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
  let sand_pixels = 0;

  // const findPart = (col) => {
  //   if (col < cols / 3) {
  //     return 1;
  //   } else if (col < (2 * cols) / 3) {
  //     return 2;
  //   } else {
  //     return 3;
  //   }
  // };

  // findPart but with any nparts
  const findPartWithNParts = (col) => {
    const partSize = COLS / NPARTS;
    for (let i = 0; i < NPARTS; i++) {
      if (col < (i + 1) * partSize) {
        return i + 1;
      }
    }
  };

  // transform the col so that you are on the same col if you are on different part
  // const transformCol = (col, part) => {
  //   if (part === 1) {
  //     return col;
  //   } else if (part === 2) {
  //     return col - Math.floor(cols / 3);
  //   } else {
  //     return col - Math.floor((2 * cols) / 3);
  //   }
  // };

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
        biome = getAdvancedBiome(col, row);
      } else {
        const part = findPartWithNParts(col);
        const transformedCol = transformColWithNParts(col, part);
        biome = getAdvancedBiomeWithParts(transformedCol, row, part);
      }

      // calculate the number of ocean pixels
      if (biome.backgroundColor === "#0000FF") ocean_pixels++;
      if (biome.backgroundColor === "#F5DEB3") sand_pixels++;

      // Save the data for JSON
      data.push({
        idx: idx,
        position: { x: x, y: y },
        color: biome.backgroundColor, // Extract the color for this index
      });

      idx++;
    }
  }
  console.log({ ocean_pixels, idx });
  // print the % of ocean, sand, desert, forest, mountain
  console.log({ ocean_pixels: (ocean_pixels / idx) * 100 });
  console.log({ sand_pixels: (sand_pixels / idx) * 100 });

  const jsonData = JSON.stringify(data);

  // Save the JSON to a file
  fs.writeFile("hexData.json", jsonData, "utf8", function (err) {
    if (err) {
      console.log("An error occured while writing JSON Object to File.");
      return console.log(err);
    }
    console.log("JSON file has been saved.");
  });
};

generateAndSaveMap();
