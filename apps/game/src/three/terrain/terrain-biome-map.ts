import { BiomeType } from "@bibliothecadao/types/terrain";
import { DataTexture, NearestFilter, RGBAFormat, UnsignedByteType } from "three";

import type { HexPosition } from "@bibliothecadao/types";

import { TERRAIN_BIOME_GROUNDS, TERRAIN_GROUNDS, type TerrainGround } from "./terrain-palette";

export const BIOME_MAP_SIZE = 256;

const BIOME_NUMBERS: readonly BiomeType[] = Object.values(BiomeType);
export const biomeNumber = (biome: BiomeType): number => BIOME_NUMBERS.indexOf(biome);
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
    cells: Iterable<{ col: number; row: number; biome: BiomeType | null }>,
    origin: HexPosition,
    climateAt: (col: number, row: number) => { elevation: number; moisture: number },
  ): void {
    let wrote = false;
    for (const { col, row, biome } of cells) {
      if (biome === null) continue;
      const at = biomeMapTexel(col - origin.col, row - origin.row) * 4;
      const climate = climateAt(col, row);
      this.texels[at] = biomeNumber(biome);
      this.texels[at + 1] = groundNumber(TERRAIN_BIOME_GROUNDS[biome]);
      this.texels[at + 2] = Math.round(climate.elevation * 255);
      this.texels[at + 3] = Math.round(climate.moisture * 255);
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
