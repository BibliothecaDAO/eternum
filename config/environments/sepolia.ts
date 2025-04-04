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
    // 3 minutes
    armiesTickIntervalInSeconds: 180,
  },
  hyperstructures: {
    ...CommonEternumGlobalConfig.hyperstructures,
    hyperstructureInitializationShardsCost: {
      resource: CommonEternumGlobalConfig.hyperstructures.hyperstructureInitializationShardsCost.resource,
      amount: CommonEternumGlobalConfig.hyperstructures.hyperstructureInitializationShardsCost.amount / 100_000,
     },
      hyperstructureConstructionCost: CommonEternumGlobalConfig.hyperstructures.hyperstructureConstructionCost.map((cost) => ({
      ...cost,
      min_amount: cost.min_amount / 100_000,
      max_amount: cost.max_amount / 100_000,
    })),
  },
  exploration: {
    ...CommonEternumGlobalConfig.exploration,
    agentFindProbability: 1,
    agentFindFailProbability: 5,
    shardsMinesFailProbability: 1,
    shardsMinesWinProbability: 20,
  },
  resources: {
    ...CommonEternumGlobalConfig.resources,
    productionByComplexRecipeOutputs: Object.fromEntries(
      Object.entries(CommonEternumGlobalConfig.resources.productionByComplexRecipeOutputs).map(([key, value]) => [
        key,
        value * 10,
      ]),
    ),
    productionBySimpleRecipeOutputs: Object.fromEntries(
      Object.entries(CommonEternumGlobalConfig.resources.productionBySimpleRecipeOutputs).map(([key, value]) => [
        key,
        value * 10,
      ]),
    ),
    laborOutputPerResource: Object.fromEntries(
      Object.entries(CommonEternumGlobalConfig.resources.laborOutputPerResource).map(([key, value]) => [
        key,
        value * 10,
      ]),
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
    startSettlingAfterSeconds: 0,
    startMainAfterSeconds: 1,
  },
};

console.log("Welcome to Sepolia!");

export default SepoliaEternumGlobalConfig;
