/**
 * Local environment configuration for Eternum.
 * Extends the common configuration with development-specific settings.
 *
 * @module LocalEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import { QuestType, ResourcesIds, ResourceTier, type Config } from "@bibliothecadao/eternum";
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
    stamina: {
      ...CommonEternumGlobalConfig.troop.stamina,
      staminaTravelStaminaCost: 0,
      staminaExploreStaminaCost: 0,
    },
  },
  exploration: {
    ...CommonEternumGlobalConfig.exploration,
    hyperstructureWinProbAtCenter: 100_000,
    hyperstructureFailProbAtCenter: 20_000,
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
  // quest resources x1000
  questResources: {
    ...CommonEternumGlobalConfig.questResources,
    [QuestType.Settle]: [
      { resource: ResourcesIds.Wheat, amount: 1_200_000_000 },
      { resource: ResourcesIds.Fish, amount: 1_200_000_000 },
    ],
    [QuestType.BuildFood]: [
      { resource: ResourcesIds.Wood, amount: 5_000_000 },
      { resource: ResourcesIds.Stone, amount: 5_000_000 },
      { resource: ResourcesIds.Coal, amount: 5_000_000 },
      { resource: ResourcesIds.Copper, amount: 5_000_000 },
      { resource: ResourcesIds.Obsidian, amount: 5_000_000 },
      { resource: ResourcesIds.Silver, amount: 5_000_000 },
      { resource: ResourcesIds.Ironwood, amount: 5_000_000 },
      { resource: ResourcesIds.ColdIron, amount: 5_000_000 },
      { resource: ResourcesIds.Gold, amount: 5_000_000 },
      { resource: ResourcesIds.Hartwood, amount: 5_000_000 },
      { resource: ResourcesIds.Diamonds, amount: 5_000_000 },
      { resource: ResourcesIds.Sapphire, amount: 5_000_000 },
      { resource: ResourcesIds.Ruby, amount: 5_000_000 },
      { resource: ResourcesIds.DeepCrystal, amount: 5_000_000 },
      { resource: ResourcesIds.Ignium, amount: 5_000_000 },
      { resource: ResourcesIds.EtherealSilica, amount: 5_000_000 },
      { resource: ResourcesIds.TrueIce, amount: 5_000_000 },
      { resource: ResourcesIds.TwilightQuartz, amount: 5_000_000 },
      { resource: ResourcesIds.AlchemicalSilver, amount: 5_000_000 },
      { resource: ResourcesIds.Adamantine, amount: 5_000_000 },
      { resource: ResourcesIds.Mithral, amount: 5_000_000 },
      { resource: ResourcesIds.Dragonhide, amount: 5_000_000 },
    ],
    [QuestType.BuildResource]: [{ resource: ResourcesIds.Donkey, amount: 200_000 }],
    [QuestType.PauseProduction]: [
      { resource: ResourcesIds.Knight, amount: 500_000 },
      { resource: ResourcesIds.Crossbowman, amount: 500_000 },
      { resource: ResourcesIds.Paladin, amount: 500_000 },
    ],
    [QuestType.CreateAttackArmy]: [
      { resource: ResourcesIds.Knight, amount: 500_000 },
      { resource: ResourcesIds.Paladin, amount: 500_000 },
      { resource: ResourcesIds.Crossbowman, amount: 500_000 },
    ],
    [QuestType.CreateDefenseArmy]: [{ resource: ResourcesIds.Donkey, amount: 200_000 }],
    [QuestType.Travel]: [{ resource: ResourcesIds.Donkey, amount: 200_000 }],
    [QuestType.CreateTrade]: [
      { resource: ResourcesIds.Donkey, amount: 200_000 },
      { resource: ResourcesIds.Paladin, amount: 200_000 },
      { resource: ResourcesIds.Knight, amount: 200_000 },
      { resource: ResourcesIds.Crossbowman, amount: 200_000 },
      { resource: ResourcesIds.AncientFragment, amount: 200_000 },
    ],
  },
  speed: {
    ...CommonEternumGlobalConfig.speed,
    // 1 second per km
    donkey: 1,
  },
  season: {
    ...CommonEternumGlobalConfig.season,
    startAfterSeconds: 60, // 1 minute
  },
};

export default LocalEternumGlobalConfig;
