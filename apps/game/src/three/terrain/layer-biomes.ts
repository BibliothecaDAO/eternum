import type { BiomeClimateConfig, ExpeditionRules } from "@bibliothecadao/eternum";
import { isDeepTile } from "@bibliothecadao/eternum/game-client";
import { DEEP_PALETTE } from "./deep-floor-material";
import { etherealSurfaceAt } from "./ethereal-depths";
import type { HexPosition } from "@bibliothecadao/types";
import { DataTexture, NearestFilter, RGBAFormat, UnsignedByteType } from "three";
import { BIOME_MAP_SIZE, biomeMapTexel } from "./terrain-biome-map";
import { TerrainNoise } from "./terrain-noise";

export type PersonalLayer = 1 | 2;

export type LayerPlace = "veil" | "hollow" | "deep";

export const LAYER_DEPTHS = { veil: 0.5, hollow: 0.7, deep: 1 } as const satisfies Record<LayerPlace, number>;

export const LAYER_BIOMES = {
  1: ["lantern-drift", "pearl-flats", "frostfall", "stillstone"],
  2: ["rootweave", "glowcap-grove", "bloomvault", "amber-seep"],
} as const satisfies Record<PersonalLayer, readonly string[]>;

export function layerOfSurface(surface: unknown): PersonalLayer | null {
  if (surface === 1) return 1;
  if (surface === 2 || surface === 3) return 2;
  return null;
}

export type LayerBiome = (typeof LAYER_BIOMES)[PersonalLayer][number];

type LayerBiomeLook = { name: string; ground: string; shade: string; glow: string };

export const LAYER_BIOME_LOOKS = {
  "lantern-drift": { name: "Lantern drift", ground: "#7a8a97", shade: "#5e6c79", glow: "#b9c8ff" },
  "pearl-flats": { name: "Pearl flats", ground: "#8d9aa3", shade: "#6c7983", glow: "#c8d4ff" },
  frostfall: { name: "Frostfall", ground: "#7d8b99", shade: "#5d6b7a", glow: "#c8d4ff" },
  stillstone: { name: "Stillstone", ground: "#787f94", shade: "#60667a", glow: "#a9b4ff" },
  rootweave: { name: "Rootweave", ground: "#6f7a48", shade: "#3f4a30", glow: "#ffb84d" },
  "glowcap-grove": { name: "Glowcap grove", ground: "#7f9248", shade: "#4a5a30", glow: "#ffb84d" },
  bloomvault: { name: "Bloomvault", ground: "#86628a", shade: "#4e3660", glow: "#c97fdc" },
  "amber-seep": { name: "Amber seep", ground: "#b08a56", shade: "#74583a", glow: "#ffc061" },
} as const satisfies Record<LayerBiome, LayerBiomeLook>;

export const EVERY_LAYER_BIOME: readonly LayerBiome[] = [...LAYER_BIOMES[1], ...LAYER_BIOMES[2]];

const layerBiomeNumber = (biome: LayerBiome): number => EVERY_LAYER_BIOME.indexOf(biome) + 1;

const ZONE_HEXES = 5;
const fields = new Map<string, TerrainNoise>();

export function layerBiomeAt(layer: PersonalLayer, col: number, row: number, climate: BiomeClimateConfig): LayerBiome {
  const seeds = `${climate.elevation_seed ?? 0}:${climate.moisture_seed ?? 0}`;
  let field = fields.get(seeds);
  if (!field) {
    field = new TerrainNoise(climate.elevation_seed ?? 0, climate.moisture_seed ?? 0);
    fields.set(seeds, field);
  }
  const drift = field.sample(col / ZONE_HEXES, row / ZONE_HEXES, `layer-${layer}-drift`);
  const chill = field.sample(col / ZONE_HEXES, row / ZONE_HEXES, `layer-${layer}-chill`);
  return LAYER_BIOMES[layer][(drift > 0.5 ? 1 : 0) + (chill > 0.5 ? 2 : 0)];
}

export function layerGroundColour(
  rules: ExpeditionRules | null,
  sharedDeep: boolean,
  hex: { col: number; row: number; alt: boolean },
  climate: BiomeClimateConfig,
): string | null {
  if (rules && sharedDeep && isDeepTile(rules.spacing, hex)) return DEEP_PALETTE.slate;
  const layer = layerOfSurface(etherealSurfaceAt(rules, hex, false));
  return layer ? LAYER_BIOME_LOOKS[layerBiomeAt(layer, hex.col, hex.row, climate)].ground : null;
}

export class LayerBiomeMap {
  readonly texture: DataTexture;
  private readonly texels = new Uint8Array(BIOME_MAP_SIZE * BIOME_MAP_SIZE * 4);

  constructor() {
    this.texture = new DataTexture(this.texels, BIOME_MAP_SIZE, BIOME_MAP_SIZE, RGBAFormat, UnsignedByteType);
    this.texture.name = "terrain-layer-biome-map";
    this.texture.magFilter = NearestFilter;
    this.texture.minFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  write(
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
      this.texels[biomeMapTexel(col - origin.col, row - origin.row) * 4] = layerBiomeNumber(biome);
      wrote = true;
    }
    if (wrote) this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
