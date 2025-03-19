/**
 * Local environment configuration for Eternum.
 * Extends the common configuration with development-specific settings.
 *
 * @module LocalEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import { BuildingType, RealmLevels, ResourcesIds, ResourceTier, type Config } from "@bibliothecadao/eternum";
import { EternumGlobalConfig as CommonEternumGlobalConfig } from "./_shared_";
import { multiplyStartingResources } from "./utils/resource";

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
    },
  },
  exploration: {
    ...CommonEternumGlobalConfig.exploration,
    shardsMinesWinProbability: 2_000,
    shardsMinesFailProbability: 10_000,
    hyperstructureWinProbAtCenter: 20_000,
    hyperstructureFailProbAtCenter: 100_000,
    hyperstructureFailProbIncreasePerHexDistance: 20,
  },
  // cheap hyperstructures
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
    ...CommonEternumGlobalConfig.startingResources.filter(
      (resource) => resource.resource !== ResourcesIds.AncientFragment,
    ),
    ...multiplyStartingResources(1000).filter((resource) => resource.resource !== ResourcesIds.AncientFragment),
    ...[{ resource: ResourcesIds.AncientFragment, amount: 1_000_000_000 }],
  },
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
    otherBuildingCosts: {
      ...CommonEternumGlobalConfig.buildings.otherBuildingCosts,
      [BuildingType.Farm]: [
        { resource: ResourcesIds.Wood, amount: 1 },
        { resource: ResourcesIds.Stone, amount: 1 },
        { resource: ResourcesIds.Coal, amount: 1 },
      ],
    },
    buildingCapacity: {
      ...CommonEternumGlobalConfig.buildings.buildingCapacity,
      [BuildingType.Castle]: 1000,
    },
  },
};

export default LocalEternumGlobalConfig;
