/**
 * Sepolia testnet environment configuration for Eternum.
 * Extends the common configuration with testnet-specific settings.
 *
 * @module SepoliaEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import { type Config } from "@bibliothecadao/types";
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
    // 2 minutes
    armiesTickIntervalInSeconds: 60 * 2,
  },
  village: {
    ...CommonEternumGlobalConfig.village,
    village_mint_initial_recipient: "0x054f2b25070d70d49f1c1f7c10Ef2639889fDAc15894D3FBa1a03caF5603eCA3",
  },
  troop: {
    ...CommonEternumGlobalConfig.troop,
    limit: {
      ...CommonEternumGlobalConfig.troop.limit,
      mercenariesTroopLowerBound: 100,
      mercenariesTroopUpperBound: 1500,
    },
  },
  season: {
    ...CommonEternumGlobalConfig.season,
    pointRegistrationCloseAfterEndSeconds: 60 * 60 * 1, // 1 hour after season end
    bridgeCloseAfterEndSeconds: 60 * 60 * 1, // 1 hour after season end
    startSettlingAfterSeconds: 60 * 30, // 30 minutes
    startMainAfterSeconds: 60 * 60, // 1 hour
  },
  battle: {
    ...CommonEternumGlobalConfig.battle,
    graceTickCount: 40, // 4 ticks depending on armiesTickIntervalInSeconds
  },
};

console.log("Welcome to Sepolia!");

export default SepoliaEternumGlobalConfig;
