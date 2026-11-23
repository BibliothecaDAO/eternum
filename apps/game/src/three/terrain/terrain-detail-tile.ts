import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
} from "three";

const DETAIL_TILE_SIZE = 256;

export function buildDetailTileTexels(size = DETAIL_TILE_SIZE): Uint8Array {
  const step = 1 / size;
  const stoneGrid = new Float32Array(size * size);
  const grainGrid = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    const v = y * step;
    const row = y * size;
    for (let x = 0; x < size; x += 1) {
      const u = x * step;
      const e1 = tilingStonesEdgeAndName(u * 9, v * 9, 9, 3);
      const edge1 = e1.edge;
      const name1 = e1.name;
      const e2 = tilingStonesEdge(u * 23, v * 23, 23, 7);
      const crack = Math.pow(clamp(edge1 * 4.5), 0.6);
      stoneGrid[row + x] = crack * (0.72 + name1 * 0.28) * (0.85 + clamp(e2 * 3) * 0.15);
      grainGrid[row + x] =
        tilingNoise(u * 8, v * 8, 8, 11) * 0.5 +
        tilingNoise(u * 24, v * 24, 24, 13) * 0.3 +
        tilingNoise(u * 56, v * 56, 56, 17) * 0.2;
    }
  }
  const texels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const row = y * size;
    const up = ((y + 1) % size) * size;
    const down = ((y - 1 + size) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const at = (row + x) * 4;
      const right = (x + 1) % size;
      const left = (x - 1 + size) % size;
      texels[at] = toByte(stoneGrid[row + x]);
      texels[at + 1] = toByte(grainGrid[row + x]);
      texels[at + 2] = toByte(0.5 + (stoneGrid[row + right] - stoneGrid[row + left]) * 2);
      texels[at + 3] = toByte(0.5 + (stoneGrid[up + x] - stoneGrid[down + x]) * 2);
    }
  }
  return texels;
}

export function buildWaveTileTexels(size = DETAIL_TILE_SIZE): Uint8Array {
  const step = 1 / size;
  const rippleGrid = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    const v = y * step;
    const row = y * size;
    for (let x = 0; x < size; x += 1) {
      const u = x * step;
      rippleGrid[row + x] =
        tilingNoise(u * 6, v * 6, 6, 21) * 0.55 +
        tilingNoise(u * 13, v * 13, 13, 23) * 0.3 +
        tilingNoise(u * 29, v * 29, 29, 27) * 0.15;
    }
  }
  const texels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const v = y * step;
    const row = y * size;
    const up = ((y + 1) % size) * size;
    const down = ((y - 1 + size) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const u = x * step;
      const ragged = tilingNoise(u * 10, v * 10, 10, 31) * 0.6 + tilingNoise(u * 37, v * 37, 37, 33) * 0.4;
      const edge = tilingStonesEdge(u * 7 + rippleGrid[row + x] * 0.6, v * 7, 7, 37);
      const at = (row + x) * 4;
      const right = (x + 1) % size;
      const left = (x - 1 + size) % size;
      texels[at] = toByte(0.5 + (rippleGrid[row + right] - rippleGrid[row + left]) * 9);
      texels[at + 1] = toByte(0.5 + (rippleGrid[up + x] - rippleGrid[down + x]) * 9);
      texels[at + 2] = toByte(ragged);
      texels[at + 3] = toByte(Math.pow(clamp(1 - edge * 5), 3));
    }
  }
  return texels;
}

let detail: DataTexture | null = null;
let wave: DataTexture | null = null;

export function terrainDetailTile(): DataTexture {
  detail ??= repeatingTile(buildDetailTileTexels(), "terrain-detail-tile");
  return detail;
}

export function terrainWaveTile(): DataTexture {
  wave ??= repeatingTile(buildWaveTileTexels(), "terrain-wave-tile");
  return wave;
}

function repeatingTile(texels: Uint8Array, name: string): DataTexture {
  const tile = new DataTexture(texels, DETAIL_TILE_SIZE, DETAIL_TILE_SIZE, RGBAFormat, UnsignedByteType);
  tile.name = name;
  tile.wrapS = RepeatWrapping;
  tile.wrapT = RepeatWrapping;
  tile.magFilter = LinearFilter;
  tile.minFilter = LinearMipmapLinearFilter;
  tile.generateMipmaps = true;
  tile.anisotropy = 4;
  tile.needsUpdate = true;
  return tile;
}

function latticeState(x: number, y: number, period: number, salt: number): number {
  const wx = ((x % period) + period) % period;
  const wy = ((y % period) + period) % period;
  let state = (Math.imul(wx, 0x9e3779b1) ^ Math.imul(wy, 0x85ebca77) ^ Math.imul(salt, 0xc2b2ae3d)) >>> 0;
  state = (state ^ (state >>> 15)) >>> 0;
  state = Math.imul(state, 0x2c1b3c6d) >>> 0;
  return (state ^ (state >>> 12)) >>> 0;
}

function tilingNoise(x: number, y: number, period: number, salt: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const fx = x - cx;
  const fy = y - cy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a00 = (latticeState(cx, cy, period, salt) & 0xffff) / 65_535;
  const a10 = (latticeState(cx + 1, cy, period, salt) & 0xffff) / 65_535;
  const a01 = (latticeState(cx, cy + 1, period, salt) & 0xffff) / 65_535;
  const a11 = (latticeState(cx + 1, cy + 1, period, salt) & 0xffff) / 65_535;
  const top = a00 + (a10 - a00) * ux;
  const bottom = a01 + (a11 - a01) * ux;
  return top + (bottom - top) * uy;
}

const stoneResult = { edge: 0, name: 0 };

function tilingStonesEdgeAndName(x: number, y: number, period: number, salt: number): { edge: number; name: number } {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let nearest = Infinity;
  let second = Infinity;
  let name = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const state = latticeState(cx + dx, cy + dy, period, salt);
      const jx = (state & 0xffff) / 65_535;
      const jy = ((Math.imul(state, 0x297a2d39) ^ (state >>> 15)) & 0xffff) / 65_535;
      const rx = cx + dx + 0.15 + jx * 0.7 - x;
      const ry = cy + dy + 0.15 + jy * 0.7 - y;
      const distance = Math.sqrt(rx * rx + ry * ry);
      if (distance < nearest) {
        second = nearest;
        nearest = distance;
        name = jx;
      } else if (distance < second) {
        second = distance;
      }
    }
  }
  stoneResult.edge = second - nearest;
  stoneResult.name = name;
  return stoneResult;
}

function tilingStonesEdge(x: number, y: number, period: number, salt: number): number {
  return tilingStonesEdgeAndName(x, y, period, salt).edge;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const toByte = (value: number) => Math.floor(clamp(value) * 255);
