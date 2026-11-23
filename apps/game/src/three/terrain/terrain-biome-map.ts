import type { BiomeClimateConfig } from "@bibliothecadao/eternum";
import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types/terrain";
import { DataTexture, NearestFilter, RGBAFormat, UnsignedByteType } from "three";

import type { HexPosition } from "@bibliothecadao/types";

import { layerBiomeAt, layerBiomeNumber, layerOfSurface } from "./layer-biomes";
import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import { TERRAIN_BIOME_GROUNDS, TERRAIN_GROUNDS, type TerrainGround } from "./terrain-palette";

export const BIOME_MAP_SIZE = 256;
export const LAYER_BIOME_OFFSET = 128;
export const BIOMES_BY_ID: readonly BiomeType[] = Object.values(BiomeType).toSorted(
  (a, b) => BiomeTypeToId[a] - BiomeTypeToId[b],
);

export const groundNumber = (ground: TerrainGround): number => TERRAIN_GROUNDS.indexOf(ground);
const WATER_GROUND = groundNumber("water");

function biomeMapTexel(col: number, row: number): number {
  const wrap = (value: number) => ((value % BIOME_MAP_SIZE) + BIOME_MAP_SIZE) % BIOME_MAP_SIZE;
  return wrap(row) * BIOME_MAP_SIZE + wrap(col);
}

export class TerrainBiomeMap {
  readonly texture: DataTexture;
  private readonly texels = new Uint8Array(BIOME_MAP_SIZE * BIOME_MAP_SIZE * 4);

  constructor() {
    this.texture = new DataTexture(this.texels, BIOME_MAP_SIZE, BIOME_MAP_SIZE, RGBAFormat, UnsignedByteType);
    this.texture.name = "terrain-biome-map";
    this.texture.magFilter = NearestFilter;
    this.texture.minFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  write(
    cells: Iterable<{ col: number; row: number; biome: BiomeType | null; surfacePresentation?: unknown }>,
    origin: HexPosition,
  ): void {
    const touched: HexPosition[] = [];
    for (const { col, row, biome, surfacePresentation } of cells) {
      if (biome === null || layerOfSurface(surfacePresentation) !== null) continue;
      const at = biomeMapTexel(col - origin.col, row - origin.row) * 4;
      this.texels[at] = BiomeTypeToId[biome];
      this.texels[at + 1] = groundNumber(TERRAIN_BIOME_GROUNDS[biome]);
      this.texels[at + 2] = 0;
      this.texels[at + 3] = 0;
      touched.push({ col, row });
    }
    if (touched.length === 0) return;
    const toBake = new Map<number, HexPosition>();
    for (const cell of touched) {
      toBake.set(biomeMapTexel(cell.col - origin.col, cell.row - origin.row), cell);
      for (const neighbor of terrainNeighborCoordinates(cell.col, cell.row)) {
        const index = biomeMapTexel(neighbor.col - origin.col, neighbor.row - origin.row);
        const neighborBiome = this.texels[index * 4];
        if (neighborBiome !== 0 && neighborBiome < LAYER_BIOME_OFFSET && !toBake.has(index))
          toBake.set(index, neighbor);
      }
    }
    for (const cell of toBake.values()) this.bakeBorderLean(cell.col, cell.row, origin);
    this.texture.needsUpdate = true;
  }

  private bakeBorderLean(col: number, row: number, origin: HexPosition): void {
    const at = biomeMapTexel(col - origin.col, row - origin.row) * 4;
    const ownBiome = this.texels[at];
    if (ownBiome === 0 || ownBiome >= LAYER_BIOME_OFFSET) return;
    const center = terrainHexToWorld(col, row);
    let leanX = 0;
    let leanZ = 0;
    let fallbackX = 0;
    let fallbackZ = 0;
    let dominantBiome = 0;
    for (const neighbor of terrainNeighborCoordinates(col, row)) {
      const nAt = biomeMapTexel(neighbor.col - origin.col, neighbor.row - origin.row) * 4;
      const besideBiome = this.texels[nAt];
      const besideKind = this.texels[nAt + 1];
      if (
        besideBiome === 0 ||
        besideBiome >= LAYER_BIOME_OFFSET ||
        besideKind === WATER_GROUND ||
        besideBiome === ownBiome
      )
        continue;
      const besideWorld = terrainHexToWorld(neighbor.col, neighbor.row);
      const dx = besideWorld.x - center.x;
      const dz = besideWorld.z - center.z;
      if (besideBiome > dominantBiome) {
        dominantBiome = besideBiome;
        leanX = dx;
        leanZ = dz;
        fallbackX = dx;
        fallbackZ = dz;
      } else if (besideBiome === dominantBiome) {
        leanX += dx;
        leanZ += dz;
      }
    }
    if (dominantBiome === 0) {
      this.texels[at + 2] = 0;
      this.texels[at + 3] = 0;
      return;
    }
    const useFallback = Math.hypot(leanX, leanZ) < 1e-4;
    const angle = Math.atan2(useFallback ? fallbackZ : leanZ, useFallback ? fallbackX : leanX);
    this.texels[at + 2] = dominantBiome;
    this.texels[at + 3] = Math.round(((angle + Math.PI) / (Math.PI * 2)) * 254) + 1;
  }

  writeLayers(
    cells: Iterable<{ col: number; row: number; surfacePresentation?: unknown }>,
    origin: HexPosition,
    mapCenter: number,
    climate: BiomeClimateConfig,
  ): void {
    let wrote = false;
    for (const { col, row, surfacePresentation } of cells) {
      const layer = layerOfSurface(surfacePresentation);
      if (!layer) continue;
      const biome = layerBiomeAt(layer, col + mapCenter, row + mapCenter, climate);
      const at = biomeMapTexel(col - origin.col, row - origin.row) * 4;
      this.texels[at] = LAYER_BIOME_OFFSET + layerBiomeNumber(biome);
      this.texels[at + 1] = 0;
      this.texels[at + 2] = 0;
      this.texels[at + 3] = 0;
      wrote = true;
    }
    if (wrote) this.texture.needsUpdate = true;
  }

  read(
    col: number,
    row: number,
  ): {
    biome: number;
    ground: number;
    borderBiome: number;
    borderLean: number;
    written: boolean;
  } {
    const at = biomeMapTexel(col, row) * 4;
    return {
      biome: this.texels[at],
      ground: this.texels[at + 1],
      borderBiome: this.texels[at + 2],
      borderLean: this.texels[at + 3],
      written: this.texels[at] !== 0,
    };
  }

  dispose(): void {
    this.texture.dispose();
  }
}
