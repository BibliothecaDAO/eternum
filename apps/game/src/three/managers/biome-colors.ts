import { BiomeIdToType, BiomeType } from "@bibliothecadao/types";
import * as THREE from "three";

export const BIOME_COLORS: Record<BiomeType | "Empty", THREE.Color> = {
  None: new THREE.Color("#000000"),
  DeepOcean: new THREE.Color("#4a6b63"),
  Ocean: new THREE.Color("#657d71"),
  Beach: new THREE.Color("#d7b485"),
  Scorched: new THREE.Color("#393131"),
  Bare: new THREE.Color("#d1ae7f"),
  Tundra: new THREE.Color("#cfd4d4"),
  Snow: new THREE.Color("#cfd4d4"),
  TemperateDesert: new THREE.Color("#ad6c44"),
  Shrubland: new THREE.Color("#c1aa7f"),
  Taiga: new THREE.Color("#292d23"),
  Grassland: new THREE.Color("#6f7338"),
  TemperateDeciduousForest: new THREE.Color("#6f7338"),
  TemperateRainForest: new THREE.Color("#6f573e"),
  SubtropicalDesert: new THREE.Color("#926338"),
  TropicalSeasonalForest: new THREE.Color("#897049"),
  TropicalRainForest: new THREE.Color("#8a714a"),
  Empty: new THREE.Color("#000000"),
};

export function resolveBiomeTypeFromId(biomeId: number | undefined): BiomeType | null {
  if (biomeId === undefined) return null;
  const biome = BiomeIdToType[biomeId];
  return biome && biome !== BiomeType.None ? biome : null;
}

export function requireBiomeTypeFromId(biomeId: number): BiomeType {
  const biome = resolveBiomeTypeFromId(biomeId);
  if (!biome) throw new Error(`Unknown explored-tile biome id ${biomeId}`);
  return biome;
}

export function requireBiomeColor(biome: BiomeType): THREE.Color {
  const color = BIOME_COLORS[biome];
  if (!color) throw new Error(`Missing biome color for ${biome}`);
  return color;
}
