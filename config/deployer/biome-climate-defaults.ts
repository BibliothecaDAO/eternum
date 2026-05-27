import type { Config as EternumConfig } from "@bibliothecadao/types";

export const buildNeutralBiomeClimateConfig = () => ({
  elevationScaleBps: 10_000,
  moistureScaleBps: 10_000,
  elevationBiasBps: 10_000,
  moistureBiasBps: 10_000,
  elevationSeed: 0,
  moistureSeed: 0,
});

export function applyBiomeClimateDefaults(configuration: EternumConfig): EternumConfig {
  return {
    ...configuration,
    biomeClimate: {
      ...buildNeutralBiomeClimateConfig(),
      ...configuration.biomeClimate,
    },
  };
}
