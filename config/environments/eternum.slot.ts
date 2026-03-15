/**
 * Cartridge Slot network environment configuration for Eternum.
 * Extends the common configuration with slot network-specific settings.
 *
 * @module SlotEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import type { Config } from "@bibliothecadao/types";
import { EternumGlobalConfig as CommonEternumGlobalConfig } from "./_shared_";

/**
 * Configuration specific to the Cartridge Slot network environment.
 * Overrides specific values from the common configuration while inheriting defaults.
 */
export const SlotEternumGlobalConfig: Config = {
  ...CommonEternumGlobalConfig,
  exploration: {
    ...CommonEternumGlobalConfig.exploration,
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
  season: {
    ...CommonEternumGlobalConfig.season,
    startSettlingAfterSeconds: 59, // 1 minute
    startMainAfterSeconds: 60,
    durationSeconds: 60 * 60 * 2, // 2 hours
    pointRegistrationCloseAfterEndSeconds: 60 * 10, // 10 minutes
  },
  battle: {
    ...CommonEternumGlobalConfig.battle,
    regularImmunityTicks: 1,
    villageImmunityTicks: 3,
    villageRaidImmunityTicks: 1,
  },
};

export default SlotEternumGlobalConfig;
