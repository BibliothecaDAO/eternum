// import { snoise } from "@dojoengine/utils";
import * as fs from "fs";
import * as math from "mathjs";

export const MAP_AMPLITUDE = 10;

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

const mod289 = (x) => {
  return x.map((v) => v - Math.floor(v * (1.0 / 289.0)) * 289.0);
};

const permute = (x) => {
  x = x.map((v) => (v * 34.0 + 1.0) * v);
  return mod289(x);
};

const taylorInvSqrt = (r) => {
  return r.map((v) => 1.79284291400159 - 0.85373472095314 * v);
};

export const snoise = (v) => {
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
  let p1 = permute(math.add(i[2], [0.0, i1[2], i2[2], 1.0]));
  let p2 = permute(math.add(math.add(p1, i[1]), [0.0, i1[1], i2[1], 1.0]));
  let p = permute(math.add(math.add(p2, i[0]), [0.0, i1[0], i2[0], 1.0]));

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

export const getBiome = (col, row) => {
  // const seed = Math.floor(((snoise([col / MAP_AMPLITUDE, 0, row / MAP_AMPLITUDE]) + 1) / 2) * 100);
  const noise1 = snoise([col / MAP_AMPLITUDE, 0, row / MAP_AMPLITUDE]);
  const noise2 = snoise([col / (MAP_AMPLITUDE * 3), 0, row / (MAP_AMPLITUDE * 3)]);

  const combinedNoise = (noise1 + noise2) / 2;

  const seed = Math.floor(((combinedNoise + 1) / 2) * 100);

  // Determine background color based on different conditions
  let backgroundColor = "white";
  let depth = 1;
  if (seed > 60) {
    backgroundColor = "blue";
    depth = 0.4;
  } else if (seed > 40) {
    backgroundColor = "#4F9153";
    depth = 0.7;
  } else if (seed > 30) {
    backgroundColor = "#002D04";
    depth = 1.4;
  } else if (seed > 20) {
    backgroundColor = "#2c4c3b";
    depth = 1.6;
  } else if (seed > 15) {
    backgroundColor = "gray";
    depth = 2;
  } else {
    backgroundColor = "black";
    depth = 3;
  }

  return { backgroundColor, depth };
};

let data = []; // Array to store the data for JSON file

let idx = 0;

let cols = 100;
let rows = 100;
let hexRadius = 3;

const hexHeight = hexRadius * 2;
const hexWidth = Math.sqrt(3) * hexRadius;
const vertDist = hexHeight * 0.75;
const horizDist = hexWidth;

for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const x = col * horizDist + ((row % 2) * horizDist) / 2;
    const y = row * vertDist;
    const biome = getBiome(col, row);

    // Save the data for JSON
    data.push({
      idx: idx,
      position: { x: x, y: y },
      color: biome.backgroundColor, // Extract the color for this index
    });

    idx++;
  }
}

const jsonData = JSON.stringify(data);

// Save the JSON to a file
fs.writeFile("hexData.json", jsonData, "utf8", function (err) {
  if (err) {
    console.log("An error occured while writing JSON Object to File.");
    return console.log(err);
  }
  console.log("JSON file has been saved.");
});
