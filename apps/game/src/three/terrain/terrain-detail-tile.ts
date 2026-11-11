import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
} from "three";

/** The ground's detail tile is this many texels a side, and repeats about once a world unit (the shader scales it). */
const DETAIL_TILE_SIZE = 256;

/**
 * The ground's detail as a tile that repeats, four bytes a texel. Red: the height of its stones, low in the cracks
 * between them. Green: a grain. Blue and alpha: the stones' slope east and south, round 0.5. Every pattern repeats
 * within the tile, so the tile meets itself without a seam.
 */
export function buildDetailTileTexels(size = DETAIL_TILE_SIZE): Uint8Array {
  const stones = (u: number, v: number) => {
    const [edge, name] = tilingStones(u * 9, v * 9, 9, 3);
    const [fine] = tilingStones(u * 23, v * 23, 23, 7);
    const crack = Math.pow(clamp(edge * 4.5), 0.6);
    return crack * (0.72 + name * 0.28) * (0.85 + clamp(fine * 3) * 0.15);
  };
  const grain = (u: number, v: number) =>
    tilingNoise(u * 8, v * 8, 8, 11) * 0.5 +
    tilingNoise(u * 24, v * 24, 24, 13) * 0.3 +
    tilingNoise(u * 56, v * 56, 56, 17) * 0.2;
  const texels = new Uint8Array(size * size * 4);
  const step = 1 / size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [u, v] = [x * step, y * step];
      const at = (y * size + x) * 4;
      texels[at] = toByte(stones(u, v));
      texels[at + 1] = toByte(grain(u, v));
      texels[at + 2] = toByte(0.5 + (stones(u + step, v) - stones(u - step, v)) * 2);
      texels[at + 3] = toByte(0.5 + (stones(u, v + step) - stones(u, v - step)) * 2);
    }
  }
  return texels;
}

let shared: DataTexture | null = null;

/** The one detail tile every ground material reads, built on first use. */
export function terrainDetailTile(): DataTexture {
  if (shared) return shared;
  shared = new DataTexture(buildDetailTileTexels(), DETAIL_TILE_SIZE, DETAIL_TILE_SIZE, RGBAFormat, UnsignedByteType);
  shared.name = "terrain-detail-tile";
  shared.wrapS = RepeatWrapping;
  shared.wrapT = RepeatWrapping;
  shared.magFilter = LinearFilter;
  shared.minFilter = LinearMipmapLinearFilter;
  shared.generateMipmaps = true;
  shared.anisotropy = 4;
  shared.needsUpdate = true;
  return shared;
}

/** Two numbers in [0, 1] for a cell of a lattice that repeats every `period` cells. */
function lattice(x: number, y: number, period: number, salt: number): [number, number] {
  const wrap = (value: number) => ((value % period) + period) % period;
  let state = (Math.imul(wrap(x), 0x9e3779b1) ^ Math.imul(wrap(y), 0x85ebca77) ^ Math.imul(salt, 0xc2b2ae3d)) >>> 0;
  state = (state ^ (state >>> 15)) >>> 0;
  state = Math.imul(state, 0x2c1b3c6d) >>> 0;
  state = (state ^ (state >>> 12)) >>> 0;
  const other = (Math.imul(state, 0x297a2d39) ^ (state >>> 15)) >>> 0;
  return [(state & 0xffff) / 65_535, (other & 0xffff) / 65_535];
}

/** Smooth noise that repeats every `period` cells. */
function tilingNoise(x: number, y: number, period: number, salt: number): number {
  const [cx, cy] = [Math.floor(x), Math.floor(y)];
  const [fx, fy] = [x - cx, y - cy];
  const [ux, uy] = [fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)];
  const at = (dx: number, dy: number) => lattice(cx + dx, cy + dy, period, salt)[0];
  const top = at(0, 0) + (at(1, 0) - at(0, 0)) * ux;
  const bottom = at(0, 1) + (at(1, 1) - at(0, 1)) * ux;
  return top + (bottom - top) * uy;
}

/** How far a point is from the edge of its stone, in a scatter that repeats every `period` cells, and the stone's name. */
function tilingStones(x: number, y: number, period: number, salt: number): [number, number] {
  const [cx, cy] = [Math.floor(x), Math.floor(y)];
  let [nearest, second, name] = [Infinity, Infinity, 0];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const [jx, jy] = lattice(cx + dx, cy + dy, period, salt);
      const distance = Math.hypot(cx + dx + 0.15 + jx * 0.7 - x, cy + dy + 0.15 + jy * 0.7 - y);
      if (distance < nearest) {
        second = nearest;
        nearest = distance;
        name = jx;
      } else if (distance < second) {
        second = distance;
      }
    }
  }
  return [second - nearest, name];
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const toByte = (value: number) => Math.floor(clamp(value) * 255);
