/**
 * Mainnet environment configuration for Eternum.
 * Extends the common configuration with production-specific settings.
 *
 * @module MainnetEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import { RealmLevels, ResourcesIds } from "@bibliothecadao/types";
import type { Config } from "@bibliothecadao/types";
import { getSeasonAddresses, type Chain } from "@contracts";
import { EternumGlobalConfig as CommonEternumGlobalConfig } from "./_shared_";

/**
 * Configuration specific to the Cartridge Slot network environment.
 * Overrides specific values from the common configuration while inheriting defaults.
 */
export const MainnetEternumGlobalConfig: Config = {
  ...CommonEternumGlobalConfig,
  exploration: {
    ...CommonEternumGlobalConfig.exploration,
    hyperstructureWinProbAtCenter: 0,
    hyperstructureFailProbAtCenter: 1,
  },
  // cheap hyperstructures
  hyperstructures: {
    ...CommonEternumGlobalConfig.hyperstructures,
    hyperstructureInitializationShardsCost: {
      resource: CommonEternumGlobalConfig.hyperstructures.hyperstructureInitializationShardsCost.resource,
      amount: 0,
    },
    hyperstructureConstructionCost: [],
  },
  troop: {
    ...CommonEternumGlobalConfig.troop,
    // stamina: {
    //   ...CommonEternumGlobalConfig.troop.stamina,
    //   staminaTravelStaminaCost: 0,
    //   staminaExploreStaminaCost: 0,
    //   staminaBonusValue: 0,
    // },
  },
  season: {
    ...CommonEternumGlobalConfig.season,
    startSettlingAfterSeconds: 59, // 1 minute
    startMainAfterSeconds: 60,
    durationSeconds: 60 * 60 * 1, // 1 hour (Series 0)
    pointRegistrationCloseAfterEndSeconds: 60 * 10, // 10 minutes
  },
  battle: {
    ...CommonEternumGlobalConfig.battle,
    regularImmunityTicks: 0,
    villageImmunityTicks: 0,
  },
  // Series 0: All Realms start at City level — no City upgrade cost
  realmUpgradeCosts: {
    [RealmLevels.Settlement]: [],
    [RealmLevels.City]: [], // Realms start as Cities; no upgrade cost
    [RealmLevels.Kingdom]: [
      { resource: ResourcesIds.Labor, amount: 720 },
      { resource: ResourcesIds.Wheat, amount: 2_400 },
      { resource: ResourcesIds.Essence, amount: 600 },
      { resource: ResourcesIds.Wood, amount: 360 },
    ],
    [RealmLevels.Empire]: [
      { resource: ResourcesIds.Labor, amount: 1_440 },
      { resource: ResourcesIds.Wheat, amount: 4_800 },
      { resource: ResourcesIds.Essence, amount: 1_200 },
      { resource: ResourcesIds.Wood, amount: 720 },
      { resource: ResourcesIds.Coal, amount: 360 },
      { resource: ResourcesIds.Copper, amount: 360 },
    ],
  },
  // Series 0: Starting resources for Realms and Camps
  startingResources: [
    { resource: ResourcesIds.Wheat, amount: 1_000 },
    { resource: ResourcesIds.Labor, amount: 1_500 },
    { resource: ResourcesIds.Wood, amount: 360 },
    { resource: ResourcesIds.Coal, amount: 240 },
    { resource: ResourcesIds.Copper, amount: 120 },
    { resource: ResourcesIds.Donkey, amount: 500 },
    // 5,000 tokenized troops — one type selected at registration
    { resource: ResourcesIds.Knight, amount: 5_000 },
    { resource: ResourcesIds.Crossbowman, amount: 5_000 },
    { resource: ResourcesIds.Paladin, amount: 5_000 },
  ],
  // Series 0: Camp starting resources
  villageStartingResources: [
    { resource: ResourcesIds.Wheat, amount: 500 },
    { resource: ResourcesIds.Labor, amount: 5_000 },
    { resource: ResourcesIds.Donkey, amount: 1_000 },
  ],
  blitz: {
    ...CommonEternumGlobalConfig.blitz,
    registration: {
      ...CommonEternumGlobalConfig.blitz.registration,
      registration_delay_seconds: 1,
      // registration_period_seconds: 60 * 60 * 23, // 23 hours
      fee_amount: 250n * 10n ** 18n,
      fee_token: getSeasonAddresses(process.env.VITE_PUBLIC_CHAIN! as Chain)!.lords!,
    },
  },
};

export default MainnetEternumGlobalConfig;
