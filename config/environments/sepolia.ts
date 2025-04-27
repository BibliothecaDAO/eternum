/**
 * Sepolia testnet environment configuration for Eternum.
 * Extends the common configuration with testnet-specific settings.
 *
 * @module SepoliaEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import { RealmLevels, ResourcesIds, type Config } from "@bibliothecadao/types";
import { EternumGlobalConfig as CommonEternumGlobalConfig } from "./_shared_";
import { getAllResourcesWithAmount } from "./utils/resource";

/**
 * Configuration specific to the Sepolia testnet environment.
 * Overrides specific values from the common configuration while inheriting defaults.
 * Used for testing in a public network environment before mainnet deployment.
 */
// sepolia god mode
export const SepoliaEternumGlobalConfig: Config = {
  ...CommonEternumGlobalConfig,
  // no stamina cost
  village: {
    ...CommonEternumGlobalConfig.village,
    village_mint_initial_recipient: "0x054f2b25070d70d49f1c1f7c10Ef2639889fDAc15894D3FBa1a03caF5603eCA3",
  },
  troop: {
    ...CommonEternumGlobalConfig.troop,
    limit: {
      ...CommonEternumGlobalConfig.troop.limit,
      mercenariesTroopLowerBound: 100,
      mercenariesTroopUpperBound: 200,
    },
    stamina: {
      ...CommonEternumGlobalConfig.troop.stamina,
      staminaTravelFishCost: 0,
      staminaTravelWheatCost: 0,
      staminaExploreFishCost: 0,
      staminaExploreWheatCost: 0,
      staminaTravelStaminaCost: 0,
      staminaExploreStaminaCost: 0,
      staminaBonusValue: 0,
      staminaInitial: 120,
    },
  },
  exploration: {
    ...CommonEternumGlobalConfig.exploration,
    shardsMinesWinProbability: 1,
    shardsMinesFailProbability: 11,
    agentFindProbability: 1,
    agentFindFailProbability: 10,
    questFindProbability: 1,
    questFindFailProbability: 10,
  },
  // cheap hyperstructures
  hyperstructures: {
    ...CommonEternumGlobalConfig.hyperstructures,
    hyperstructureInitializationShardsCost: {
      resource: CommonEternumGlobalConfig.hyperstructures.hyperstructureInitializationShardsCost.resource,
      amount: 5_000,
    },
    hyperstructurePointsForWin: 100n,
    hyperstructureConstructionCost: CommonEternumGlobalConfig.hyperstructures.hyperstructureConstructionCost.map(
      (cost) => ({
        ...cost,
        min_amount: 12_000,
        max_amount: 12_000,
      }),
    ),
  },
  // no grace period
  battle: {
    ...CommonEternumGlobalConfig.battle,
    graceTickCount: 14, // 14 ticks so 14 hours
  },
  // starting resources x1000
  startingResources: getAllResourcesWithAmount(1_000_000).map((resource) => {
    if (
      resource.resource === ResourcesIds.Knight ||
      resource.resource === ResourcesIds.Paladin ||
      resource.resource === ResourcesIds.Crossbowman
    ) {
      return {
        ...resource,
        amount: Math.floor(CommonEternumGlobalConfig.troop.limit.explorerAndGuardMaxTroopCount / 4),
      };
    }
    return resource;
  }),
  villageStartingResources: getAllResourcesWithAmount(2_000_000).map((resource) => {
    if (
      resource.resource === ResourcesIds.Knight ||
      resource.resource === ResourcesIds.Paladin ||
      resource.resource === ResourcesIds.Crossbowman
    ) {
      return { ...resource, amount: CommonEternumGlobalConfig.troop.limit.explorerAndGuardMaxTroopCount };
    }
    return resource;
  }),
  season: {
    ...CommonEternumGlobalConfig.season,
    startSettlingAfterSeconds: 59, // 1 minute
    startMainAfterSeconds: 60,
  },
  realmUpgradeCosts: {
    ...CommonEternumGlobalConfig.realmUpgradeCosts,
    [RealmLevels.Settlement]: [],
    [RealmLevels.City]: [
      { resource: ResourcesIds.Wheat, amount: 1 },
      { resource: ResourcesIds.Fish, amount: 1 },
    ],
    [RealmLevels.Kingdom]: [
      { resource: ResourcesIds.ColdIron, amount: 1 },
      { resource: ResourcesIds.Hartwood, amount: 1 },
      { resource: ResourcesIds.Diamonds, amount: 1 },
      { resource: ResourcesIds.Sapphire, amount: 1 },
      { resource: ResourcesIds.DeepCrystal, amount: 1 },
      { resource: ResourcesIds.Wheat, amount: 1 },
      { resource: ResourcesIds.Fish, amount: 1 },
    ],
    [RealmLevels.Empire]: [
      { resource: ResourcesIds.AlchemicalSilver, amount: 1 },
      { resource: ResourcesIds.Adamantine, amount: 1 },
      { resource: ResourcesIds.Mithral, amount: 1 },
      { resource: ResourcesIds.Dragonhide, amount: 1 },
      { resource: ResourcesIds.Wheat, amount: 1 },
      { resource: ResourcesIds.Fish, amount: 1 },
    ],
  },
};

console.log("Welcome to Sepolia!");

export default SepoliaEternumGlobalConfig;
