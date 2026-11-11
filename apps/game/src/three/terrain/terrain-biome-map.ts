import { BiomeType } from "@bibliothecadao/types/terrain";
import { DataTexture, NearestFilter, RGBAFormat, UnsignedByteType } from "three";

import { toRenderHex } from "@/three/world-origin";

import { TERRAIN_BIOME_GROUNDS, TERRAIN_GROUNDS, type TerrainGround } from "./terrain-palette";

/** The biome map is this many hexes a side; a hex further than half of it from another is read at the other's texel. */
export const BIOME_MAP_SIZE = 256;

/** Every biome's number in the ground shader: its place in the catalog. */
const BIOME_NUMBERS: readonly BiomeType[] = Object.values(BiomeType);
export const biomeNumber = (biome: BiomeType): number => BIOME_NUMBERS.indexOf(biome);
export const groundNumber = (ground: TerrainGround): number => TERRAIN_GROUNDS.indexOf(ground);

/** The texel a render hex is read at, wrapped round the map so any window of hexes the map draws fits. */
function biomeMapTexel(col: number, row: number): number {
  const wrap = (value: number) => ((value % BIOME_MAP_SIZE) + BIOME_MAP_SIZE) % BIOME_MAP_SIZE;
  return wrap(row) * BIOME_MAP_SIZE + wrap(col);
}

/**
 * The biome of every hex the terrain draws, for the ground shader to read anywhere on the ground: where a frontier
 * wanders off a hex's edge, and what lies round a point; and which unexplored hexes are next to explore, for the mist to
 * draw them. One texel a hex at its render hex: red the biome's number, green its ground's, blue 255 on a hex next to
 * explore, alpha 255 once a biome is written.
 */
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

  /** Writes each cell that has a biome, normalized as the terrain's cells are, at the hex it is drawn on. */
  write(cells: Iterable<{ col: number; row: number; biome: BiomeType | null }>): void {
    let wrote = false;
    for (const { col, row, biome } of cells) {
      if (biome === null) continue;
      const render = toRenderHex(col, row);
      const at = biomeMapTexel(render.col, render.row) * 4;
      this.texels[at] = biomeNumber(biome);
      this.texels[at + 1] = groundNumber(TERRAIN_BIOME_GROUNDS[biome]);
      this.texels[at + 2] = 0;
      this.texels[at + 3] = 255;
      wrote = true;
    }
    if (wrote) this.texture.needsUpdate = true;
  }

  /** Marks each unexplored cell as next to explore or not, at the hex it is drawn on. */
  writeUnexplored(cells: Iterable<{ col: number; row: number; frontier: boolean }>): void {
    let wrote = false;
    for (const { col, row, frontier } of cells) {
      const render = toRenderHex(col, row);
      const at = biomeMapTexel(render.col, render.row) * 4;
      this.texels[at + 2] = frontier ? 255 : 0;
      this.texels[at + 3] = 0;
      wrote = true;
    }
    if (wrote) this.texture.needsUpdate = true;
  }

  /** What the map holds at a render hex: for tests and probes. */
  read(col: number, row: number): { biome: number; ground: number; next: boolean; written: boolean } {
    const at = biomeMapTexel(col, row) * 4;
    return {
      biome: this.texels[at],
      ground: this.texels[at + 1],
      next: this.texels[at + 2] === 255,
      written: this.texels[at + 3] === 255,
    };
  }

  dispose(): void {
    this.texture.dispose();
  }
}
