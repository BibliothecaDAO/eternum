import type { BiomeClimateConfig } from "@bibliothecadao/eternum";
import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types/terrain";
import { DataTexture, NearestFilter, RGBAFormat, UnsignedByteType } from "three";

import type { HexPosition } from "@bibliothecadao/types";

import { layerBiomeAt, layerBiomeNumber, layerOfSurface } from "./layer-biomes";
import { TERRAIN_BIOME_GROUNDS, TERRAIN_GROUNDS, type TerrainGround } from "./terrain-palette";

export const BIOME_MAP_SIZE = 256;
export const LAYER_BIOME_OFFSET = 128;
export const BIOMES_BY_ID: readonly BiomeType[] = Object.values(BiomeType).toSorted(
  (a, b) => BiomeTypeToId[a] - BiomeTypeToId[b],
);

export const groundNumber = (ground: TerrainGround): number => TERRAIN_GROUNDS.indexOf(ground);

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
    climateAt: (col: number, row: number) => { elevation: number; moisture: number },
  ): void {
    let wrote = false;
    for (const { col, row, biome, surfacePresentation } of cells) {
      if (biome === null || layerOfSurface(surfacePresentation) !== null) continue;
      const at = biomeMapTexel(col - origin.col, row - origin.row) * 4;
      const climate = climateAt(col, row);
      this.texels[at] = BiomeTypeToId[biome];
      this.texels[at + 1] = groundNumber(TERRAIN_BIOME_GROUNDS[biome]);
      this.texels[at + 2] = Math.round(climate.elevation * 255);
      this.texels[at + 3] = Math.round(climate.moisture * 255);
      wrote = true;
    }
    if (wrote) this.texture.needsUpdate = true;
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

  read(col: number, row: number): { biome: number; ground: number; climate: [number, number]; written: boolean } {
    const at = biomeMapTexel(col, row) * 4;
    return {
      biome: this.texels[at],
      ground: this.texels[at + 1],
      climate: [this.texels[at + 2] / 255, this.texels[at + 3] / 255],
      written: this.texels[at] !== 0,
    };
  }

  dispose(): void {
    this.texture.dispose();
  }
}
