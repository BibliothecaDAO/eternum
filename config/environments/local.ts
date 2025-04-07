/**
 * Local environment configuration for Eternum.
 * Extends the common configuration with development-specific settings.
 *
 * @module LocalEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import { BuildingType, RealmLevels, ResourcesIds, ResourceTier, type Config } from "@bibliothecadao/eternum";
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
  },
  // cheap hyperstructures
  hyperstructures: {
    ...CommonEternumGlobalConfig.hyperstructures,
    hyperstructureTotalCosts: [
      { resource_tier: ResourceTier.Lords, min_amount: 500, max_amount: 500 },
      { resource_tier: ResourceTier.Common, min_amount: 120_000, max_amount: 120_000 },
    ],
  },
  // no grace period
  battle: {
    ...CommonEternumGlobalConfig.battle,
    graceTickCount: 0,
    graceTickCountHyp: 0,
    delaySeconds: 0,
  },
  // starting resources x1000
  startingResources: getAllResourcesWithAmount(1000000),
  villageStartingResources: getAllResourcesWithAmount(1000000),
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
      { resource: ResourcesIds.Wheat, amount: 1 },
      { resource: ResourcesIds.Fish, amount: 1 },
    ],
    [RealmLevels.Empire]: [
      { resource: ResourcesIds.Wheat, amount: 1 },
      { resource: ResourcesIds.Fish, amount: 1 },
    ],
  },
  buildings: {
    ...CommonEternumGlobalConfig.buildings,
    buildingFixedCostScalePercent: 1,
    complexBuildingCosts: {
      ...CommonEternumGlobalConfig.buildings.complexBuildingCosts,
      [BuildingType.ResourceWheat]: [{ resource: ResourcesIds.Fish, amount: 1 }],
      [BuildingType.ResourceFish]: [{ resource: ResourcesIds.Wheat, amount: 1 }],
      [BuildingType.ResourceKnightT1]: [{ resource: ResourcesIds.Labor, amount: 1 }],
      [BuildingType.ResourceKnightT2]: [{ resource: ResourcesIds.Labor, amount: 1 }],
      [BuildingType.ResourceKnightT3]: [{ resource: ResourcesIds.Labor, amount: 1 }],
      [BuildingType.ResourceCrossbowmanT1]: [{ resource: ResourcesIds.Labor, amount: 1 }],
      [BuildingType.ResourceCrossbowmanT2]: [{ resource: ResourcesIds.Labor, amount: 1 }],
      [BuildingType.ResourceCrossbowmanT3]: [{ resource: ResourcesIds.Labor, amount: 1 }],
      [BuildingType.ResourcePaladinT1]: [{ resource: ResourcesIds.Labor, amount: 1 }],
      [BuildingType.ResourcePaladinT2]: [{ resource: ResourcesIds.Labor, amount: 1 }],
      [BuildingType.ResourcePaladinT3]: [{ resource: ResourcesIds.Labor, amount: 1 }],
    },
    buildingPopulation: {
        ...CommonEternumGlobalConfig.buildings.buildingPopulation,
        [BuildingType.ResourceWheat]: 0,
        [BuildingType.ResourceFish]: 0,
        [BuildingType.ResourceKnightT1]: 0,
        [BuildingType.ResourceKnightT2]: 0,
        [BuildingType.ResourceKnightT3]: 0,
        [BuildingType.ResourceCrossbowmanT1]: 0,
        [BuildingType.ResourceCrossbowmanT2]: 0,
        [BuildingType.ResourceCrossbowmanT3]: 0,
        [BuildingType.ResourcePaladinT1]: 0,
        [BuildingType.ResourcePaladinT2]: 0,
        [BuildingType.ResourcePaladinT3]: 0,
      },  
  },
  resources: {
    ...CommonEternumGlobalConfig.resources,
    resourceWeightsGrams: {
      ...CommonEternumGlobalConfig.resources.resourceWeightsGrams,
      [ResourcesIds.Wheat]: 1,
      [ResourcesIds.Fish]: 1,
      [ResourcesIds.Knight]: 1,
      [ResourcesIds.KnightT2]: 1,
      [ResourcesIds.KnightT3]: 1,
      [ResourcesIds.Crossbowman]: 1,
      [ResourcesIds.CrossbowmanT2]: 1,
      [ResourcesIds.CrossbowmanT3]: 1,
      [ResourcesIds.Paladin]: 1,
      [ResourcesIds.PaladinT2]: 1,
      [ResourcesIds.PaladinT3]: 1,
    },
    productionByComplexRecipe: {
      ...CommonEternumGlobalConfig.resources.productionByComplexRecipe,
      [ResourcesIds.Wheat]: [{resource: ResourcesIds.Fish, amount: 1}],
      [ResourcesIds.Fish]: [{resource: ResourcesIds.Wheat, amount: 1}],
      [ResourcesIds.Knight]: [{resource: ResourcesIds.Wheat, amount: 1}],
      [ResourcesIds.KnightT2]: [{resource: ResourcesIds.Wheat, amount: 1}],
      [ResourcesIds.KnightT3]: [{resource: ResourcesIds.Wheat, amount: 1}],
      [ResourcesIds.Crossbowman]: [{resource: ResourcesIds.Wheat, amount: 1}],
      [ResourcesIds.CrossbowmanT2]: [{resource: ResourcesIds.Wheat, amount: 1}],
      [ResourcesIds.CrossbowmanT3]: [{resource: ResourcesIds.Wheat, amount: 1}],
      [ResourcesIds.Paladin]: [{resource: ResourcesIds.Wheat, amount: 1}],
      [ResourcesIds.PaladinT2]: [{resource: ResourcesIds.Wheat, amount: 1}],
      [ResourcesIds.PaladinT3]: [{resource: ResourcesIds.Wheat, amount: 1}],
    },
  },
};

export default LocalEternumGlobalConfig;
