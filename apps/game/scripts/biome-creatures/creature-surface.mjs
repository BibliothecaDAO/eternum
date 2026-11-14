import { MeshoptSimplifier } from "meshoptimizer";

/**
 * Turns a creature's volume into its skin: one closed triangle mesh, drawn tight on the volume's surface and thinned
 * to the triangle budget the map can afford.
 */
export async function skinVolume(volume, { cellSize, triangleBudget }) {
  const dense = extractSurface(volume, cellSize);
  settleOnSurface(dense.positions, volume);
  const mesh = await thinToBudget(dense, triangleBudget);
  settleOnSurface(mesh.positions, volume);
  return { ...mesh, normals: surfaceNormals(mesh.positions, volume) };
}

/** Surface nets: one vertex in every grid cell the surface crosses, one quad across every grid edge it cuts. */
function extractSurface(volume, cellSize) {
  const margin = cellSize * 3;
  const origin = volume.bounds.slice(0, 3).map((low) => low - margin);
  const counts = volume.bounds.slice(3).map((high, axis) => Math.ceil((high + margin - origin[axis]) / cellSize) + 1);
  const [nx, ny, nz] = counts;
  const field = sampleField(volume, origin, counts, cellSize);
  const at = (i, j, k) => field[i + nx * (j + ny * k)];
  const cellVertex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cellIndex = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const positions = [];
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const crossing = cellCrossing(at, i, j, k);
        if (!crossing) continue;
        cellVertex[cellIndex(i, j, k)] = positions.length / 3;
        positions.push(
          origin[0] + (i + crossing[0]) * cellSize,
          origin[1] + (j + crossing[1]) * cellSize,
          origin[2] + (k + crossing[2]) * cellSize,
        );
      }
  const indices = [];
  const quad = (a, b, c, d, outward) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (outward) indices.push(a, b, c, a, c, d);
    else indices.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const inside = at(i, j, k) < 0;
        const cell = (di, dj, dk) => cellVertex[cellIndex(i + di, j + dj, k + dk)];
        if (inside !== at(i + 1, j, k) < 0)
          quad(cell(0, -1, -1), cell(0, 0, -1), cell(0, 0, 0), cell(0, -1, 0), inside);
        if (inside !== at(i, j + 1, k) < 0)
          quad(cell(-1, 0, -1), cell(-1, 0, 0), cell(0, 0, 0), cell(0, 0, -1), inside);
        if (inside !== at(i, j, k + 1) < 0)
          quad(cell(-1, -1, 0), cell(0, -1, 0), cell(0, 0, 0), cell(-1, 0, 0), inside);
      }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

function sampleField(volume, origin, [nx, ny, nz], cellSize) {
  const field = new Float32Array(nx * ny * nz);
  let index = 0;
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++)
        field[index++] = Math.min(
          volume.distance(origin[0] + i * cellSize, origin[1] + j * cellSize, origin[2] + k * cellSize),
          1e3,
        );
  return field;
}

const CELL_EDGES = [
  [0, 0, 0, 1, 0, 0],
  [0, 1, 0, 1, 1, 0],
  [0, 0, 1, 1, 0, 1],
  [0, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 1, 0],
  [1, 0, 0, 1, 1, 0],
  [0, 0, 1, 0, 1, 1],
  [1, 0, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 1],
  [0, 1, 0, 0, 1, 1],
  [1, 1, 0, 1, 1, 1],
];

/** Where in the cell the surface passes, as the mean of its crossings of the cell's edges; null if it misses. */
function cellCrossing(at, i, j, k) {
  let x = 0,
    y = 0,
    z = 0,
    crossings = 0;
  for (const [ai, aj, ak, bi, bj, bk] of CELL_EDGES) {
    const a = at(i + ai, j + aj, k + ak);
    const b = at(i + bi, j + bj, k + bk);
    if (a < 0 === b < 0) continue;
    const t = a / (a - b);
    x += ai + (bi - ai) * t;
    y += aj + (bj - aj) * t;
    z += ak + (bk - ak) * t;
    crossings++;
  }
  return crossings ? [x / crossings, y / crossings, z / crossings] : null;
}

const GRADIENT_STEP = 0.002;

function gradientAt(volume, x, y, z) {
  return [
    volume.distance(x + GRADIENT_STEP, y, z) - volume.distance(x - GRADIENT_STEP, y, z),
    volume.distance(x, y + GRADIENT_STEP, z) - volume.distance(x, y - GRADIENT_STEP, z),
    volume.distance(x, y, z + GRADIENT_STEP) - volume.distance(x, y, z - GRADIENT_STEP),
  ].map((difference) => difference / (GRADIENT_STEP * 2));
}

/** Slides each vertex along the volume's slope onto its true surface. */
function settleOnSurface(positions, volume) {
  for (let pass = 0; pass < 2; pass++)
    for (let offset = 0; offset < positions.length; offset += 3) {
      const [x, y, z] = [positions[offset], positions[offset + 1], positions[offset + 2]];
      const distance = volume.distance(x, y, z);
      const [gx, gy, gz] = gradientAt(volume, x, y, z);
      const slope = gx * gx + gy * gy + gz * gz;
      if (!Number.isFinite(distance) || slope < 1e-6) continue;
      positions[offset] = x - (distance * gx) / slope;
      positions[offset + 1] = y - (distance * gy) / slope;
      positions[offset + 2] = z - (distance * gz) / slope;
    }
}

function surfaceNormals(positions, volume) {
  const normals = new Float32Array(positions.length);
  for (let offset = 0; offset < positions.length; offset += 3) {
    const [gx, gy, gz] = gradientAt(volume, positions[offset], positions[offset + 1], positions[offset + 2]);
    const length = Math.hypot(gx, gy, gz) || 1;
    normals.set([gx / length, gy / length, gz / length], offset);
  }
  return normals;
}

/** Removes the triangles the eye misses least, then drops the vertices nothing uses any more. */
async function thinToBudget({ positions, indices }, triangleBudget) {
  await MeshoptSimplifier.ready;
  const [thinned] = MeshoptSimplifier.simplify(indices, positions, 3, triangleBudget * 3, 0.02);
  const remap = new Int32Array(positions.length / 3).fill(-1);
  const kept = [];
  const compactIndices = new Uint32Array(thinned.length);
  thinned.forEach((vertex, corner) => {
    if (remap[vertex] < 0) {
      remap[vertex] = kept.length / 3;
      kept.push(positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]);
    }
    compactIndices[corner] = remap[vertex];
  });
  return { positions: new Float32Array(kept), indices: compactIndices };
}
