import type { FactoryBiomeClimateOverrides } from "@bibliothecadao/types";
import { getConfigFromNetwork, resolveBlitzConfigForDuration } from "@config";
import type { FactoryGameMode, FactoryLaunchChain } from "./types";

export type FactoryBiomeClimateFieldId = keyof FactoryBiomeClimateDraft;

export type FactoryBiomeClimateDraft = {
  elevationScaleBps: string;
  moistureScaleBps: string;
  elevationBiasBps: string;
  moistureBiasBps: string;
  elevationSeed: string;
  moistureSeed: string;
};

export type FactoryBiomeClimateErrors = Record<FactoryBiomeClimateFieldId, string | null>;

interface FactoryBiomeClimateValidationResult {
  errors: FactoryBiomeClimateErrors;
  biomeClimateOverrides?: FactoryBiomeClimateOverrides;
  firstError: string | null;
  hasErrors: boolean;
}

const BIOME_CLIMATE_BPS_MAX = 65_535;
const BIOME_CLIMATE_SEED_MAX = 4_294_967_295;
const NEUTRAL_BIOME_CLIMATE = {
  elevationScaleBps: 10_000,
  moistureScaleBps: 10_000,
  elevationBiasBps: 10_000,
  moistureBiasBps: 10_000,
  elevationSeed: 0,
  moistureSeed: 0,
};

const BIOME_CLIMATE_FIELDS: Array<{
  id: FactoryBiomeClimateFieldId;
  label: string;
  max: number;
}> = [
  { id: "elevationScaleBps", label: "Elevation scale BPS", max: BIOME_CLIMATE_BPS_MAX },
  { id: "moistureScaleBps", label: "Moisture scale BPS", max: BIOME_CLIMATE_BPS_MAX },
  { id: "elevationBiasBps", label: "Elevation bias BPS", max: BIOME_CLIMATE_BPS_MAX },
  { id: "moistureBiasBps", label: "Moisture bias BPS", max: BIOME_CLIMATE_BPS_MAX },
  { id: "elevationSeed", label: "Elevation seed", max: BIOME_CLIMATE_SEED_MAX },
  { id: "moistureSeed", label: "Moisture seed", max: BIOME_CLIMATE_SEED_MAX },
];

const createEmptyBiomeErrors = (): FactoryBiomeClimateErrors => ({
  elevationScaleBps: null,
  moistureScaleBps: null,
  elevationBiasBps: null,
  moistureBiasBps: null,
  elevationSeed: null,
  moistureSeed: null,
});

const resolveConfig = (chain: FactoryLaunchChain, mode: FactoryGameMode, durationMinutes?: number | null) =>
  mode === "blitz" ? resolveBlitzConfigForDuration(chain, durationMinutes) : getConfigFromNetwork(chain, mode);

const resolveBaseClimate = (chain: FactoryLaunchChain, mode: FactoryGameMode, durationMinutes?: number | null) =>
  resolveConfig(chain, mode, durationMinutes).biomeClimate ?? NEUTRAL_BIOME_CLIMATE;

const parseBiomeInteger = (value: string): number | null => {
  const trimmedValue = value.trim();

  if (!/^\d+$/.test(trimmedValue)) {
    return null;
  }

  const parsed = Number(trimmedValue);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const validateBiomeField = (field: (typeof BIOME_CLIMATE_FIELDS)[number], value: string) => {
  const parsedValue = parseBiomeInteger(value);

  if (parsedValue === null || parsedValue < 0 || parsedValue > field.max) {
    return `${field.label} must be an integer between 0 and ${field.max}.`;
  }

  return null;
};

export const createFactoryBiomeClimateDraft = (
  chain: FactoryLaunchChain,
  mode: FactoryGameMode,
  durationMinutes?: number | null,
): FactoryBiomeClimateDraft => {
  const baseClimate = resolveBaseClimate(chain, mode, durationMinutes);

  return {
    elevationScaleBps: String(baseClimate.elevationScaleBps),
    moistureScaleBps: String(baseClimate.moistureScaleBps),
    elevationBiasBps: String(baseClimate.elevationBiasBps),
    moistureBiasBps: String(baseClimate.moistureBiasBps),
    elevationSeed: String(baseClimate.elevationSeed),
    moistureSeed: String(baseClimate.moistureSeed),
  };
};

export const validateFactoryBiomeClimateDraft = (
  chain: FactoryLaunchChain,
  mode: FactoryGameMode,
  draft: FactoryBiomeClimateDraft,
  durationMinutes?: number | null,
): FactoryBiomeClimateValidationResult => {
  const baseClimate = resolveBaseClimate(chain, mode, durationMinutes);
  const errors = createEmptyBiomeErrors();
  const biomeClimateOverrides: FactoryBiomeClimateOverrides = {};
  let firstError: string | null = null;

  for (const field of BIOME_CLIMATE_FIELDS) {
    const value = draft[field.id];
    const error = validateBiomeField(field, value);

    if (error) {
      errors[field.id] = error;
      firstError ??= error;
      continue;
    }

    const parsedValue = parseBiomeInteger(value);
    if (parsedValue !== null && parsedValue !== baseClimate[field.id]) {
      biomeClimateOverrides[field.id] = parsedValue;
    }
  }

  return {
    errors,
    biomeClimateOverrides: Object.keys(biomeClimateOverrides).length > 0 ? biomeClimateOverrides : undefined,
    firstError,
    hasErrors: firstError !== null,
  };
};

export const randomizeFactoryBiomeSeeds = (draft: FactoryBiomeClimateDraft): FactoryBiomeClimateDraft => ({
  ...draft,
  elevationSeed: String(Math.floor(Math.random() * (BIOME_CLIMATE_SEED_MAX + 1))),
  moistureSeed: String(Math.floor(Math.random() * (BIOME_CLIMATE_SEED_MAX + 1))),
});

export const listFactoryBiomeClimateFields = () => [...BIOME_CLIMATE_FIELDS];
