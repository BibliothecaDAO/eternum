import { hashTerrainCoordinates, terrainHashToUnitFloat } from "./terrain-hash";

// A page reuses lattice corners across vertices and normal samples. Bound the cache for long-lived surface queries.
const MAX_CACHED_CORNERS = 8192;
type NoiseColumns = Map<number, Map<number, number>>;

export class TerrainNoise {
  private readonly layers = new Map<string, NoiseColumns>();
  private cachedCorners = 0;

  constructor(
    private readonly elevationSeed: number,
    private readonly moistureSeed: number,
  ) {}

  sample(x: number, z: number, salt: string): number {
    const minX = Math.floor(x);
    const minZ = Math.floor(z);
    const fractionX = smoothFraction(x - minX);
    const fractionZ = smoothFraction(z - minZ);
    const layer = this.resolveLayer(salt);
    const bottomLeft = this.corner(layer, minX, minZ, salt);
    const bottomRight = this.corner(layer, minX + 1, minZ, salt);
    const topLeft = this.corner(layer, minX, minZ + 1, salt);
    const topRight = this.corner(layer, minX + 1, minZ + 1, salt);
    const bottom = bottomLeft + (bottomRight - bottomLeft) * fractionX;
    const top = topLeft + (topRight - topLeft) * fractionX;
    return bottom + (top - bottom) * fractionZ;
  }

  private resolveLayer(salt: string): NoiseColumns {
    if (this.cachedCorners >= MAX_CACHED_CORNERS) {
      this.layers.clear();
      this.cachedCorners = 0;
    }
    let layer = this.layers.get(salt);
    if (!layer) {
      layer = new Map();
      this.layers.set(salt, layer);
    }
    return layer;
  }

  private corner(layer: NoiseColumns, col: number, row: number, salt: string): number {
    let column = layer.get(col);
    const retained = column?.get(row);
    if (retained !== undefined) return retained;
    const value = terrainHashToUnitFloat(
      hashTerrainCoordinates({
        col,
        row,
        salt,
        elevationSeed: this.elevationSeed,
        moistureSeed: this.moistureSeed,
      }),
    );
    if (!column) {
      column = new Map();
      layer.set(col, column);
    }
    column.set(row, value);
    this.cachedCorners += 1;
    return value;
  }
}

function smoothFraction(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}
