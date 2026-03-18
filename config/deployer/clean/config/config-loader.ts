import type { Config as EternumConfig } from "@bibliothecadao/types";
import { resolveDeploymentEnvironment } from "../environment";
import { loadRepoJsonFile } from "../shared/repo";
import type { DeploymentEnvironmentId } from "../types";

interface StoredConfiguration {
  configuration?: EternumConfig;
}

interface ConfigOverrides {
  startMainAt: number;
  factoryAddress: string;
  devModeOn?: boolean;
  singleRealmMode?: boolean;
  twoPlayerMode?: boolean;
  durationSeconds?: number;
}

interface ResolvedConfigOverrides {
  devModeOn: boolean;
  singleRealmMode: boolean;
  twoPlayerMode: boolean;
  durationSeconds?: number;
}

function loadStoredConfiguration(configPath: string): StoredConfiguration {
  return loadRepoJsonFile<StoredConfiguration>(configPath);
}

function requireConfigurationObject(configPath: string, parsed: StoredConfiguration): EternumConfig {
  if (!parsed.configuration) {
    throw new Error(`No configuration object found in ${configPath}`);
  }

  return parsed.configuration;
}

function requiresSeasonDurationOverride(baseConfig: EternumConfig): boolean {
  return Boolean(baseConfig.blitz?.mode?.on);
}

function resolveDurationSeconds(baseConfig: EternumConfig, overrides: ConfigOverrides): number | undefined {
  if (!requiresSeasonDurationOverride(baseConfig)) {
    return undefined;
  }

  const durationSeconds = overrides.durationSeconds ?? baseConfig.season?.durationSeconds;

  if (!Number.isFinite(durationSeconds) || !Number.isInteger(durationSeconds) || durationSeconds < 60) {
    throw new Error("durationSeconds must be an integer greater than or equal to 60");
  }

  return durationSeconds;
}

function resolveBooleanOverrides(baseConfig: EternumConfig, overrides: ConfigOverrides): ResolvedConfigOverrides {
  const singleRealmMode = overrides.singleRealmMode ?? baseConfig.settlement?.single_realm_mode ?? false;
  const twoPlayerMode = overrides.twoPlayerMode ?? baseConfig.settlement?.two_player_mode ?? false;

  if (singleRealmMode && twoPlayerMode) {
    throw new Error("single_realm_mode and two_player_mode cannot both be enabled");
  }

  return {
    devModeOn: overrides.devModeOn ?? baseConfig.dev?.mode?.on ?? false,
    singleRealmMode,
    twoPlayerMode,
    durationSeconds: resolveDurationSeconds(baseConfig, overrides),
  };
}

function applyModeOverrides(
  config: EternumConfig,
  resolvedOverrides: ResolvedConfigOverrides,
  overrides: ConfigOverrides,
): void {
  config.dev = {
    ...(config.dev ?? {}),
    mode: {
      ...(config.dev?.mode ?? {}),
      on: resolvedOverrides.devModeOn,
    },
  };
  config.season = {
    ...(config.season ?? {}),
    startMainAt: overrides.startMainAt,
    ...(resolvedOverrides.durationSeconds !== undefined ? { durationSeconds: resolvedOverrides.durationSeconds } : {}),
  };
  config.settlement = {
    ...(config.settlement ?? {}),
    single_realm_mode: resolvedOverrides.singleRealmMode,
    two_player_mode: resolvedOverrides.twoPlayerMode,
  };
}

function applyFactoryAddressOverride(config: EternumConfig, factoryAddress: string): void {
  (config as EternumConfig & { factory_address?: string }).factory_address = factoryAddress;
}

export function loadEnvironmentConfiguration(environmentId: DeploymentEnvironmentId): EternumConfig {
  const environment = resolveDeploymentEnvironment(environmentId);
  return requireConfigurationObject(environment.configPath, loadStoredConfiguration(environment.configPath));
}

export function applyDeploymentConfigOverrides(baseConfig: EternumConfig, overrides: ConfigOverrides): EternumConfig {
  const clonedConfig = structuredClone(baseConfig);
  const resolvedOverrides = resolveBooleanOverrides(clonedConfig, overrides);

  applyModeOverrides(clonedConfig, resolvedOverrides, overrides);
  applyFactoryAddressOverride(clonedConfig, overrides.factoryAddress);

  return clonedConfig;
}
