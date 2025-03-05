/**
 * Sepolia testnet environment configuration for Eternum.
 * Extends the common configuration with testnet-specific settings.
 *
 * @module SepoliaEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import { type Config } from "@bibliothecadao/eternum";
import { EternumGlobalConfig as CommonEternumGlobalConfig } from "./_shared_";

/**
 * Configuration specific to the Sepolia testnet environment.
 * Overrides specific values from the common configuration while inheriting defaults.
 * Used for testing in a public network environment before mainnet deployment.
 */
// sepolia god mode
export const SepoliaEternumGlobalConfig: Config = {
  ...CommonEternumGlobalConfig,
  tick: {
    ...CommonEternumGlobalConfig.tick,
    // 10 minutes
    armiesTickIntervalInSeconds: 600,
  },
  hyperstructures: {
    ...CommonEternumGlobalConfig.hyperstructures,
    hyperstructureCreationCosts: CommonEternumGlobalConfig.hyperstructures.hyperstructureCreationCosts.map((cost) => ({
      ...cost,
      min_amount: cost.min_amount / 100,
      max_amount: cost.max_amount / 100,
    })),
    hyperstructureConstructionCosts: CommonEternumGlobalConfig.hyperstructures.hyperstructureConstructionCosts.map(
      (cost) => ({
        ...cost,
        min_amount: cost.min_amount / 100,
        max_amount: cost.max_amount / 100,
      }),
    ),
  },
  resources: {
    ...CommonEternumGlobalConfig.resources,
    resourceOutputs: Object.fromEntries(
      Object.entries(CommonEternumGlobalConfig.resources.resourceOutputs).map(([key, value]) => [key, value * 10]),
    ),
  },
  // no grace period
  battle: {
    ...CommonEternumGlobalConfig.battle,
    graceTickCount: 0,
    graceTickCountHyp: 0,
    delaySeconds: 0,
  },
  speed: {
    ...CommonEternumGlobalConfig.speed,
    // 1 second per km
    donkey: 3,
  },
  season: {
    ...CommonEternumGlobalConfig.season,
    startAfterSeconds: 0, // 1 minute
  },
};

console.log("Welcome to Sepolia!");

export default SepoliaEternumGlobalConfig;
