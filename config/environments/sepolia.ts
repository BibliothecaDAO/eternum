/**
 * Sepolia testnet environment configuration for Eternum.
 * Extends the common configuration with testnet-specific settings.
 *
 * @module SepoliaEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import { ResourceTier, type Config } from "@bibliothecadao/eternum";
import { EternumGlobalConfig as CommonEternumGlobalConfig } from "./_shared_";
import { multiplyStartingResources } from "./utils/resource";

/**
 * Configuration specific to the Sepolia testnet environment.
 * Overrides specific values from the common configuration while inheriting defaults.
 * Used for testing in a public network environment before mainnet deployment.
 */
// sepolia god mode
export const SepoliaEternumGlobalConfig: Config = {
  ...CommonEternumGlobalConfig,
  // no stamina cost
  troop: {
    ...CommonEternumGlobalConfig.troop,
    stamina: {
      ...CommonEternumGlobalConfig.troop.stamina,
      staminaTravelStaminaCost: 0,
      staminaExploreStaminaCost: 0,
    },
  },
  hyperstructures: {
    ...CommonEternumGlobalConfig.hyperstructures,
    hyperstructureCreationCosts: [{ resource_tier: ResourceTier.Lords, min_amount: 3_000, max_amount: 3_000 }],
  },
  // no grace period
  battle: {
    ...CommonEternumGlobalConfig.battle,
    graceTickCount: 0,
    graceTickCountHyp: 0,
    delaySeconds: 0,
  },
  // starting resources x1000
  startingResources: {
    ...CommonEternumGlobalConfig.startingResources,
    ...multiplyStartingResources(1000),
  },
  speed: {
    ...CommonEternumGlobalConfig.speed,
    // 1 second per km
    donkey: 1,
  },
  season: {
    ...CommonEternumGlobalConfig.season,
    startAfterSeconds: 60, // 1 minute
  },
};

console.log("Welcome to Sepolia!");

export default SepoliaEternumGlobalConfig;
