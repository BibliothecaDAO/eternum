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
  season: {
    ...CommonEternumGlobalConfig.season,
    startSettlingAfterSeconds: 59, // 1 minute
    startMainAfterSeconds: 60,
    durationSeconds: 60 * 60 * 2, // 2 hours
  },
  battle: {
    ...CommonEternumGlobalConfig.battle,
    graceTickCount: 0,
    graceTickCountHyp: 0,
    delaySeconds: 0,
  },
  blitz: {
    ...CommonEternumGlobalConfig.blitz,
    registration: {
      ...CommonEternumGlobalConfig.blitz.registration,
      registration_delay_seconds: 20,
      registration_period_seconds: 60 * 60 * 48,
      creation_period_seconds: 60 * 60 * 1,
    },
  },
};

export default SlotEternumGlobalConfig;
