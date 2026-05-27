import { Biome, type BiomeClimateConfig } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { BIOME_COLORS } from "@/three/managers/biome-colors";

export interface FactoryBiomeClimateValues {
  elevationScaleBps?: number;
  moistureScaleBps?: number;
  elevationBiasBps?: number;
  moistureBiasBps?: number;
  elevationSeed?: number;
  moistureSeed?: number;
}

interface BiomePreviewClimateInput {
  baseClimate?: FactoryBiomeClimateValues;
  overrides: {
    elevationScaleBps?: string;
    moistureScaleBps?: string;
    elevationBiasBps?: string;
    moistureBiasBps?: string;
    elevationSeed?: string;
    moistureSeed?: string;
  };
}

interface BiomePreviewTile {
  key: string;
  col: number;
  row: number;
  biome: BiomeType;
  color: string;
}

interface BiomePreviewInput {
  climate: BiomeClimateConfig;
  size: number;
  center: number;
  mapCenter?: number;
}

interface BiomePreviewDistributionEntry {
  biome: BiomeType;
  color: string;
  count: number;
  percentage: number;
}

interface BiomePreviewModel {
  tiles: BiomePreviewTile[];
  distribution: BiomePreviewDistributionEntry[];
}

const NEUTRAL_BIOME_CLIMATE_BPS = 10_000;
const MINIMUM_PREVIEW_SIZE = 3;

const parsePreviewInteger = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
};

const resolveBpsValue = (value: string | undefined, fallback: number | undefined): number =>
  parsePreviewInteger(value, fallback ?? NEUTRAL_BIOME_CLIMATE_BPS);

const resolveSeedValue = (value: string | undefined, fallback: number | undefined): number =>
  parsePreviewInteger(value, fallback ?? 0);

const normalizePreviewSize = (size: number): number => Math.max(MINIMUM_PREVIEW_SIZE, Math.trunc(size));

const getBiomeColor = (biome: BiomeType): string => {
  const color = BIOME_COLORS[biome as keyof typeof BIOME_COLORS];
  return `#${color?.getHexString?.() ?? "4b5563"}`;
};

const countPreviewBiomes = (tiles: BiomePreviewTile[]): Map<BiomeType, number> => {
  const counts = new Map<BiomeType, number>();
  for (const tile of tiles) {
    counts.set(tile.biome, (counts.get(tile.biome) ?? 0) + 1);
  }
  return counts;
};

const buildBiomeDistribution = (tiles: BiomePreviewTile[]): BiomePreviewDistributionEntry[] => {
  const total = tiles.length || 1;
  return Array.from(countPreviewBiomes(tiles).entries())
    .map(([biome, count]) => ({
      biome,
      color: getBiomeColor(biome),
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((left, right) => right.count - left.count || String(left.biome).localeCompare(String(right.biome)));
};

export const buildBiomePreviewClimate = ({ baseClimate, overrides }: BiomePreviewClimateInput): BiomeClimateConfig => ({
  elevation_scale_bps: resolveBpsValue(overrides.elevationScaleBps, baseClimate?.elevationScaleBps),
  moisture_scale_bps: resolveBpsValue(overrides.moistureScaleBps, baseClimate?.moistureScaleBps),
  elevation_bias_bps: resolveBpsValue(overrides.elevationBiasBps, baseClimate?.elevationBiasBps),
  moisture_bias_bps: resolveBpsValue(overrides.moistureBiasBps, baseClimate?.moistureBiasBps),
  elevation_seed: resolveSeedValue(overrides.elevationSeed, baseClimate?.elevationSeed),
  moisture_seed: resolveSeedValue(overrides.moistureSeed, baseClimate?.moistureSeed),
});

export const buildBiomePreviewModel = ({ climate, size, center, mapCenter }: BiomePreviewInput): BiomePreviewModel => {
  const previewSize = normalizePreviewSize(size);
  const contractCenter = center + (mapCenter ?? 0);
  const start = contractCenter - Math.floor(previewSize / 2);
  const tiles: BiomePreviewTile[] = [];

  for (let rowIndex = 0; rowIndex < previewSize; rowIndex += 1) {
    for (let colIndex = 0; colIndex < previewSize; colIndex += 1) {
      const col = start + colIndex;
      const row = start + rowIndex;
      const biome = Biome.getBiome(col, row, climate);
      tiles.push({
        key: `${col}:${row}`,
        col,
        row,
        biome,
        color: getBiomeColor(biome),
      });
    }
  }

  return {
    tiles,
    distribution: buildBiomeDistribution(tiles),
  };
};
