/**
 * Local environment configuration for Eternum.
 * Extends the common configuration with development-specific settings.
 *
 * @module LocalEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import { BuildingType, type Config, RealmLevels, ResourcesIds } from "@bibliothecadao/types";
import { EternumGlobalConfig as CommonEternumGlobalConfig } from "./_shared_";
import { getAllResourcesWithAmount } from "./utils/resource";

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
    shardsMinesWinProbability: 1_000,
    shardsMinesFailProbability: 15_000,
    hyperstructureWinProbAtCenter: 20_000,
    hyperstructureFailProbAtCenter: 100_000,
    hyperstructureFailProbIncreasePerHexDistance: 20,
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
    hyperstructurePointsForWin: 100n,
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
  // starting resources x1000
  startingResources: getAllResourcesWithAmount(1_000_000).map((resource) => {
    if (
      resource.resource === ResourcesIds.Knight ||
      resource.resource === ResourcesIds.Paladin ||
      resource.resource === ResourcesIds.Crossbowman
    ) {
      return { ...resource, amount: CommonEternumGlobalConfig.troop.limit.explorerAndGuardMaxTroopCount };
    }
    return resource;
  }),
  villageStartingResources: getAllResourcesWithAmount(1_000_000).map((resource) => {
    if (
      resource.resource === ResourcesIds.Knight ||
      resource.resource === ResourcesIds.Paladin ||
      resource.resource === ResourcesIds.Crossbowman
    ) {
      return { ...resource, amount: CommonEternumGlobalConfig.troop.limit.explorerAndGuardMaxTroopCount };
    }
    return resource;
  }),
  speed: {
    ...CommonEternumGlobalConfig.speed,
    // 1 second per km
    donkey: 0,
  },
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
  buildings: {
    ...CommonEternumGlobalConfig.buildings,
    complexBuildingCosts: {
      ...CommonEternumGlobalConfig.buildings.complexBuildingCosts,
      [BuildingType.ResourceWheat]: [{ resource: ResourcesIds.Fish, amount: 1 }],
    },
    buildingPopulation: {
      ...CommonEternumGlobalConfig.buildings.buildingPopulation,
      [BuildingType.ResourceWheat]: 0,
    },
  },
};

export default LocalEternumGlobalConfig;
