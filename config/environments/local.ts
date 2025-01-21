/**
 * Local environment configuration for Eternum.
 * Extends the common configuration with development-specific settings.
 *
 * @module LocalEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import type { Config } from "@bibliothecadao/eternum";
import { EternumGlobalConfig as CommonEternumGlobalConfig } from "./_shared_";

/**
 * Configuration specific to the local development environment.
 * Overrides specific values from the common configuration while inheriting defaults.
 */
export const LocalEternumGlobalConfig: Config = {
  ...CommonEternumGlobalConfig,
  season: {
    ...CommonEternumGlobalConfig.season,
    startAfterSeconds: 60, // 1 minute
  },
};

export default LocalEternumGlobalConfig;
