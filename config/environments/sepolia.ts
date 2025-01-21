/**
 * Sepolia testnet environment configuration for Eternum.
 * Extends the common configuration with testnet-specific settings.
 *
 * @module SepoliaEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import type { Config } from "@bibliothecadao/eternum";
import { EternumGlobalConfig as CommonEternumGlobalConfig } from "./_shared_";

/**
 * Configuration specific to the Sepolia testnet environment.
 * Overrides specific values from the common configuration while inheriting defaults.
 * Used for testing in a public network environment before mainnet deployment.
 */
export const SepoliaEternumGlobalConfig: Config = {
  ...CommonEternumGlobalConfig,
  season: {
    ...CommonEternumGlobalConfig.season,
    startAfterSeconds: 60, // 1 minute
  },
};

console.log("Welcome to Sepolia!");

export default SepoliaEternumGlobalConfig;
