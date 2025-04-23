/**
 * Mainnet environment configuration for Eternum.
 * Extends the common configuration with production-specific settings.
 *
 * @module MainnetEnvironment
 * @see {@link CommonEternumGlobalConfig} for base configuration
 */

import type { Config } from "@bibliothecadao/types";
import { EternumGlobalConfig as CommonEternumGlobalConfig } from "./_shared_";

/**
 * Configuration specific to the mainnet production environment.
 * Inherits all settings from the common configuration without modifications.
 * Use this configuration with caution as it affects the live production environment.
 */
export const MainnetEternumGlobalConfig: Config = {
  ...CommonEternumGlobalConfig,
};

export default MainnetEternumGlobalConfig;
