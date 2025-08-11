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
    durationSeconds: 60 * 60 * 24 * 90, // 90 days
  },
  battle: {
    ...CommonEternumGlobalConfig.battle,
    graceTickCount: 0,
    graceTickCountHyp: 0,
    delaySeconds: 0,
  },
  dev: {
    ...CommonEternumGlobalConfig.dev,
    mode: {
      ...CommonEternumGlobalConfig.dev.mode,
      on: true,
    },
  },
  blitz: {
    ...CommonEternumGlobalConfig.blitz,
    registration: {
      ...CommonEternumGlobalConfig.blitz.registration,
      registration_delay_seconds: 20,
      registration_period_seconds: 1, // devs can always register by pressing the "H" key from the home page
    },
  },
};

export default SlotEternumGlobalConfig;
