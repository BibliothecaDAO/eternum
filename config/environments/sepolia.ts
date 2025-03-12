/**
 * Sepolia testnet environment configuration for Eternum.
 * Extends the common configuration with testnet-specific settings.
 *
 * @module SepoliaEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import { CapacityConfig, type Config, type ResourceCost, type ResourceInputs } from "@bibliothecadao/eternum";
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
  buildings: {
    ...CommonEternumGlobalConfig.buildings,
    buildingCosts: Object.fromEntries(
      Object.entries(CommonEternumGlobalConfig.buildings.buildingCosts).map(([key, value]) => [
        key,
        value.map((costs: ResourceInputs[]) => ({
          costs.map((cost: ResourceCost) => ({
            resource: cost.resource,
            amount: cost.amount / 10,
          })),
        })),
      ]),
    ),
  },
  carryCapacityGram: {
    ...CommonEternumGlobalConfig.carryCapacityGram,
    [CapacityConfig.Structure]: 4_000_000_000_000, // 4b kg
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
    startSettlingAfterSeconds: 0,
    startMainAfterSeconds: 1,
  },
};

console.log("Welcome to Sepolia!");

export default SepoliaEternumGlobalConfig;
