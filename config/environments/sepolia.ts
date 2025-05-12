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
  exploration: {
    ...CommonEternumGlobalConfig.exploration,
    questFindProbability: 1,
    questFindFailProbability: 10,
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
  questGames: [
    {
      address: "0x2418e02ae43901d8aa8ab5c4b676740dccdcf1c94f13344a978ebe6077b109",
      levels: [
        { target_score: 26, settings_id: 1, time_limit: 86400 },
        { target_score: 26, settings_id: 2, time_limit: 86400 },
        { target_score: 26, settings_id: 3, time_limit: 86400 },
        { target_score: 51, settings_id: 4, time_limit: 86400 },
        { target_score: 101, settings_id: 5, time_limit: 86400 },
      ],
      overwrite: true,
    },
  ],
};

console.log("Welcome to Sepolia!");

export default SepoliaEternumGlobalConfig;
