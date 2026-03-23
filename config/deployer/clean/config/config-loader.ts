import type {
  Config as EternumConfig,
  FactoryBlitzRegistrationOverrides,
  FactoryMapConfigOverrides,
} from "@bibliothecadao/types";
import { applyBlitzBalanceProfile, resolveBlitzBalanceProfileIdFromDurationSeconds } from "../../../source/blitz";
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
  mapConfigOverrides?: FactoryMapConfigOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
}

interface ResolvedConfigOverrides {
  devModeOn: boolean;
  singleRealmMode: boolean;
  twoPlayerMode: boolean;
  durationSeconds?: number;
}

interface ResolvedBlitzRegistrationOverrides {
  registration_count_max?: number;
  fee_token?: string;
  fee_amount?: bigint;
}

type ConfigWithFactoryAddress = EternumConfig & { factory_address?: string };

const U16_MAX = 65_535;
const U8_MAX = 255;
const HYPERSTRUCTURE_PAIR_SUM = 100_000;
const BLITZ_MAX_PLAYERS_MIN = 1;
const BLITZ_REGISTRATION_AMOUNT_PATTERN = /^\d+$/;
const STARKNET_ADDRESS_PATTERN = /^0x[0-9a-fA-F]+$/;

const MAP_CONFIG_OVERRIDE_LIMITS = {
  shardsMinesWinProbability: U16_MAX,
  shardsMinesFailProbability: U16_MAX,
  agentFindProbability: U16_MAX,
  agentFindFailProbability: U16_MAX,
  campFindProbability: U16_MAX,
  campFindFailProbability: U16_MAX,
  holysiteFindProbability: U16_MAX,
  holysiteFindFailProbability: U16_MAX,
  bitcoinMineWinProbability: U16_MAX,
  bitcoinMineFailProbability: U16_MAX,
  hyperstructureWinProbAtCenter: HYPERSTRUCTURE_PAIR_SUM,
  hyperstructureFailProbAtCenter: HYPERSTRUCTURE_PAIR_SUM,
  hyperstructureFailProbIncreasePerHexDistance: U16_MAX,
  hyperstructureFailProbIncreasePerHyperstructureFound: U16_MAX,
  relicDiscoveryIntervalSeconds: U16_MAX,
  relicHexDistanceFromCenter: U8_MAX,
  relicChestRelicsPerChest: U8_MAX,
} satisfies Record<keyof FactoryMapConfigOverrides, number>;

const MAP_CONFIG_OVERRIDE_PAIR_GROUPS = [
  {
    label: "Shard Mine chance",
    winKey: "shardsMinesWinProbability",
    failKey: "shardsMinesFailProbability",
    sum: U16_MAX,
  },
  {
    label: "Agent chance",
    winKey: "agentFindProbability",
    failKey: "agentFindFailProbability",
    sum: U16_MAX,
  },
  {
    label: "Camp chance",
    winKey: "campFindProbability",
    failKey: "campFindFailProbability",
    sum: U16_MAX,
  },
  {
    label: "Holy Site chance",
    winKey: "holysiteFindProbability",
    failKey: "holysiteFindFailProbability",
    sum: U16_MAX,
  },
  {
    label: "Bitcoin Mine chance",
    winKey: "bitcoinMineWinProbability",
    failKey: "bitcoinMineFailProbability",
    sum: U16_MAX,
  },
  {
    label: "Hyperstructure center chance",
    winKey: "hyperstructureWinProbAtCenter",
    failKey: "hyperstructureFailProbAtCenter",
    sum: HYPERSTRUCTURE_PAIR_SUM,
  },
] as const;

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

function isBlitzConfiguration(config: EternumConfig): boolean {
  return Boolean(config.blitz?.mode?.on);
}

function resolveInferredBlitzBalanceProfileId(baseConfig: EternumConfig, overrides: ConfigOverrides) {
  if (!isBlitzConfiguration(baseConfig)) {
    return null;
  }

  return resolveBlitzBalanceProfileIdFromDurationSeconds(overrides.durationSeconds);
}

function resolveBaseConfigWithInferredBlitzProfile(
  baseConfig: EternumConfig,
  overrides: ConfigOverrides,
): EternumConfig {
  const profileId = resolveInferredBlitzBalanceProfileId(baseConfig, overrides);

  if (!profileId) {
    return structuredClone(baseConfig);
  }

  return applyBlitzBalanceProfile(baseConfig, profileId);
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
  (config as ConfigWithFactoryAddress).factory_address = factoryAddress;
}

function validateMapConfigOverrideValue(key: keyof FactoryMapConfigOverrides, value: number): void {
  const limit = MAP_CONFIG_OVERRIDE_LIMITS[key];

  if (!Number.isInteger(value) || value < 0 || value > limit) {
    throw new Error(`mapConfigOverrides.${key} must be an integer between 0 and ${limit}`);
  }
}

function validateMapConfigOverridePairGroup(
  overrides: FactoryMapConfigOverrides,
  group: (typeof MAP_CONFIG_OVERRIDE_PAIR_GROUPS)[number],
): void {
  const hasWinOverride = overrides[group.winKey] !== undefined;
  const hasFailOverride = overrides[group.failKey] !== undefined;

  if (!hasWinOverride && !hasFailOverride) {
    return;
  }

  if (hasWinOverride !== hasFailOverride) {
    throw new Error(`${group.label} overrides must include both win and fail values`);
  }

  const winValue = overrides[group.winKey] ?? 0;
  const failValue = overrides[group.failKey] ?? 0;

  if (winValue + failValue !== group.sum) {
    throw new Error(`${group.label} overrides must sum to ${group.sum}`);
  }
}

export function applyMapConfigOverrides(config: EternumConfig, overrides?: FactoryMapConfigOverrides): void {
  if (!overrides) {
    return;
  }

  for (const [key, rawValue] of Object.entries(overrides)) {
    if (!(key in MAP_CONFIG_OVERRIDE_LIMITS)) {
      throw new Error(`Unsupported map config override "${key}"`);
    }

    validateMapConfigOverrideValue(key as keyof FactoryMapConfigOverrides, rawValue as number);
  }

  for (const group of MAP_CONFIG_OVERRIDE_PAIR_GROUPS) {
    validateMapConfigOverridePairGroup(overrides, group);
  }

  config.exploration = {
    ...config.exploration,
    ...overrides,
  };
}

function validateBlitzRegistrationOverridesAreAllowed(twoPlayerMode: boolean): void {
  if (twoPlayerMode) {
    throw new Error("blitz registration overrides are not supported when two_player_mode is enabled");
  }
}

function validateRegistrationCountMaxOverride(value: number): void {
  if (!Number.isInteger(value) || value < BLITZ_MAX_PLAYERS_MIN || value > U16_MAX) {
    throw new Error(
      `blitzRegistrationOverrides.registration_count_max must be an integer between ${BLITZ_MAX_PLAYERS_MIN} and ${U16_MAX}`,
    );
  }
}

function validateRegistrationFeeTokenOverride(value: string): void {
  if (!value.trim() || !STARKNET_ADDRESS_PATTERN.test(value)) {
    throw new Error('blitzRegistrationOverrides.fee_token must be a non-empty "0x" address');
  }
}

function validateRegistrationFeeAmountOverride(value: string): void {
  if (!BLITZ_REGISTRATION_AMOUNT_PATTERN.test(value)) {
    throw new Error("blitzRegistrationOverrides.fee_amount must be a non-negative integer string");
  }
}

function resolveRegistrationCountMaxOverride(
  value: FactoryBlitzRegistrationOverrides["registration_count_max"],
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number") {
    throw new Error("blitzRegistrationOverrides.registration_count_max must be a number");
  }

  validateRegistrationCountMaxOverride(value);
  return value;
}

function resolveRegistrationFeeTokenOverride(
  value: FactoryBlitzRegistrationOverrides["fee_token"],
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("blitzRegistrationOverrides.fee_token must be a string");
  }

  validateRegistrationFeeTokenOverride(value);
  return value;
}

function resolveRegistrationFeeAmountOverride(
  value: FactoryBlitzRegistrationOverrides["fee_amount"],
): bigint | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("blitzRegistrationOverrides.fee_amount must be a string");
  }

  validateRegistrationFeeAmountOverride(value);
  return BigInt(value);
}

function resolveBlitzRegistrationOverrides(
  overrides: FactoryBlitzRegistrationOverrides,
): ResolvedBlitzRegistrationOverrides {
  const registrationCountMax = resolveRegistrationCountMaxOverride(overrides.registration_count_max);
  const feeToken = resolveRegistrationFeeTokenOverride(overrides.fee_token);
  const feeAmount = resolveRegistrationFeeAmountOverride(overrides.fee_amount);

  return {
    ...(registrationCountMax !== undefined ? { registration_count_max: registrationCountMax } : {}),
    ...(feeToken !== undefined ? { fee_token: feeToken } : {}),
    ...(feeAmount !== undefined ? { fee_amount: feeAmount } : {}),
  };
}

function applyResolvedBlitzRegistrationOverrides(
  config: EternumConfig,
  resolvedOverrides: ResolvedBlitzRegistrationOverrides,
): void {
  const registration = config.blitz?.registration;

  if (!registration) {
    throw new Error("blitz registration config is missing");
  }

  config.blitz = {
    ...config.blitz,
    registration: {
      ...registration,
      ...resolvedOverrides,
    },
  };
}

export function applyBlitzRegistrationOverrides(
  config: EternumConfig,
  overrides: FactoryBlitzRegistrationOverrides | undefined,
  twoPlayerMode: boolean,
): void {
  if (!overrides) {
    return;
  }

  if (!config.blitz?.mode?.on) {
    throw new Error("blitz registration overrides are only supported for blitz environments");
  }

  validateBlitzRegistrationOverridesAreAllowed(twoPlayerMode);
  applyResolvedBlitzRegistrationOverrides(config, resolveBlitzRegistrationOverrides(overrides));
}

export function loadEnvironmentConfiguration(environmentId: DeploymentEnvironmentId): EternumConfig {
  const environment = resolveDeploymentEnvironment(environmentId);
  return requireConfigurationObject(environment.configPath, loadStoredConfiguration(environment.configPath));
}

export function applyDeploymentConfigOverrides(baseConfig: EternumConfig, overrides: ConfigOverrides): EternumConfig {
  const configWithInferredBlitzProfile = resolveBaseConfigWithInferredBlitzProfile(baseConfig, overrides);
  const resolvedOverrides = resolveBooleanOverrides(configWithInferredBlitzProfile, overrides);

  applyModeOverrides(configWithInferredBlitzProfile, resolvedOverrides, overrides);
  applyFactoryAddressOverride(configWithInferredBlitzProfile, overrides.factoryAddress);
  applyMapConfigOverrides(configWithInferredBlitzProfile, overrides.mapConfigOverrides);
  applyBlitzRegistrationOverrides(
    configWithInferredBlitzProfile,
    overrides.blitzRegistrationOverrides,
    resolvedOverrides.twoPlayerMode,
  );

  return configWithInferredBlitzProfile;
}
