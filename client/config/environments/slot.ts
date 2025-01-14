/**
* Catridge Slot network environment configuration for Eternum.
 * Extends the common configuration with slot network-specific settings.
 * 
 * @module SlotEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import type { Config } from "@bibliothecadao/eternum";
import { EternumGlobalConfig as CommonEternumGlobalConfig } from "./_shared_";

/**
 * Configuration specific to the Catridge Slot network environment.
 * Overrides specific values from the common configuration while inheriting defaults.
 */
export const SlotEternumGlobalConfig: Config = {
  ...CommonEternumGlobalConfig,
  season: {
    ...CommonEternumGlobalConfig.season,
    startAfterSeconds: 60, // 1 minute
  },
};

export default SlotEternumGlobalConfig;
