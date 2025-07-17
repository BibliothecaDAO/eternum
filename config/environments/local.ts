/**
 * Local environment configuration for Eternum.
 * Extends the common configuration with development-specific settings.
 *
 * @module LocalEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import { type Config, RealmLevels, ResourcesIds } from "@bibliothecadao/types";
import { EternumGlobalConfig as CommonEternumGlobalConfig } from "./_shared_";

/**
 * Configuration specific to the local development environment.
 * Overrides specific values from the common configuration while inheriting defaults.
 */
export const LocalEternumGlobalConfig: Config = {
  ...CommonEternumGlobalConfig,
  tick: {
    ...CommonEternumGlobalConfig.tick,
    // 5 minutes
    armiesTickIntervalInSeconds: 300,
  },
  // no stamina cost
  troop: {
    ...CommonEternumGlobalConfig.troop,
    limit: {
      ...CommonEternumGlobalConfig.troop.limit,
      mercenariesTroopLowerBound: 100,
      mercenariesTroopUpperBound: 200,
    },
    stamina: {
      ...CommonEternumGlobalConfig.troop.stamina,
      staminaTravelStaminaCost: 0,
      staminaExploreStaminaCost: 0,
      staminaBonusValue: 0,
    },
  },
  exploration: {
    ...CommonEternumGlobalConfig.exploration,
    shardsMinesWinProbability: 1,
    shardsMinesFailProbability: 9,
    hyperstructureWinProbAtCenter: 0,
    hyperstructureFailProbAtCenter: 1,
    villageFindProbability: 1,
    villageFindFailProbability: 8,
    // hyperstructureFailProbIncreasePerHexDistance: 20,
    agentFindProbability: 3_000,
    agentFindFailProbability: 10_000,
    questFindProbability: 1_000,
    questFindFailProbability: 10_000,
  },
  // cheap hyperstructures
  hyperstructures: {
    ...CommonEternumGlobalConfig.hyperstructures,
    hyperstructureInitializationShardsCost: {
      resource: CommonEternumGlobalConfig.hyperstructures.hyperstructureInitializationShardsCost.resource,
      amount: 500,
    },
    hyperstructureConstructionCost: CommonEternumGlobalConfig.hyperstructures.hyperstructureConstructionCost.map(
      (cost) => ({
        ...cost,
        min_amount: 120_000,
        max_amount: 120_000,
      }),
    ),
  },
  // no grace period
  battle: {
    ...CommonEternumGlobalConfig.battle,
    graceTickCount: 0,
    graceTickCountHyp: 0,
    delaySeconds: 0,
  },
  startingResources: [
    ...CommonEternumGlobalConfig.startingResources,
    // { resource: ResourcesIds.Essence, amount: 1000 },
    // { resource: ResourcesIds.StaminaRelic1, amount: 1000 },
    // { resource: ResourcesIds.StaminaRelic2, amount: 1000 },
    // { resource: ResourcesIds.DamageRelic1, amount: 1000 },
  ],
  villageStartingResources: [
    ...CommonEternumGlobalConfig.villageStartingResources,
    // { resource: ResourcesIds.Essence, amount: 1000 },
    // { resource: ResourcesIds.StaminaRelic1, amount: 1000 },
    // { resource: ResourcesIds.StaminaRelic2, amount: 1000 },
    // { resource: ResourcesIds.DamageRelic1, amount: 1000 },
  ],
  speed: {
    ...CommonEternumGlobalConfig.speed,
    // 1 second per km
    donkey: 0,
  },
  season: {
    ...CommonEternumGlobalConfig.season,
    startSettlingAfterSeconds: 59, // 1 minute
    startMainAfterSeconds: 60,
    durationSeconds: 60 * 60 * 24 * 30, // 1 month
  },
  realmUpgradeCosts: {
    ...CommonEternumGlobalConfig.realmUpgradeCosts,
    [RealmLevels.Settlement]: [],
    [RealmLevels.City]: [
      { resource: ResourcesIds.Labor, amount: 1 },
      { resource: ResourcesIds.Wheat, amount: 1 },
    ],
    [RealmLevels.Kingdom]: [
      { resource: ResourcesIds.Labor, amount: 2 },
      { resource: ResourcesIds.Wheat, amount: 2 },
    ],
    [RealmLevels.Empire]: [
      { resource: ResourcesIds.Labor, amount: 3 },
      { resource: ResourcesIds.Wheat, amount: 3 },
      { resource: ResourcesIds.Wood, amount: 3 },
    ],
  },
  buildings: {
    ...CommonEternumGlobalConfig.buildings,
    // complexBuildingCosts: {
    //   ...CommonEternumGlobalConfig.buildings.complexBuildingCosts,
    //   [BuildingType.ResourceWheat]: [{ resource: ResourcesIds.Fish, amount: 1 }],
    // },
    // buildingPopulation: {
    //   ...CommonEternumGlobalConfig.buildings.buildingPopulation,
    //   [BuildingType.ResourceWheat]: 0,
    // },
  },
  blitz: {
    ...CommonEternumGlobalConfig.blitz,
    registration: {
      ...CommonEternumGlobalConfig.blitz.registration,
      registration_delay_seconds: 20,
      registration_period_seconds: 60 * 5,
      creation_period_seconds: 60 * 10,
    },
  },
};

export default LocalEternumGlobalConfig;
