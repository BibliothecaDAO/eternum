import { DEFAULT_TOKEN_PRECISION, parseTokenAmountToIntegerString } from "@/ui/utils/token-amount";

interface BlitzRegistrationDefaults {
  amount: string;
  precision: number;
  token: string;
}

interface FactoryWorldConfigDefaults {
  factoryAddress: string;
  devModeOn: boolean;
  mmrEnabledOn: boolean;
  durationHours: number;
  baseDurationMinutes: number;
  defaultBlitzRegistration: BlitzRegistrationDefaults;
}

interface FactoryWorldConfigOverrides {
  startMainAt?: number;
  startSettlingAt?: number;
  devModeOn?: boolean;
  mmrEnabled?: boolean;
  gameMode?: "blitz" | "eternum";
  durationHours?: string;
  durationMinutes?: string;
  blitzFeeAmount?: string;
  blitzFeePrecision?: string;
  blitzFeeToken?: string;
  blitzFeeRecipient?: string;
  registrationCountMax?: string;
  registrationDelaySeconds?: string;
  registrationPeriodSeconds?: string;
  factoryAddress?: string;
  singleRealmMode?: boolean;
  twoPlayerMode?: boolean;
  seasonBridgeCloseAfterEndSeconds?: string;
  seasonPointRegistrationCloseAfterEndSeconds?: string;
  settlementCenter?: string;
  settlementBaseDistance?: string;
  settlementSubsequentDistance?: string;
  tradeMaxCount?: string;
  battleGraceTickCount?: string;
  battleGraceTickCountHyp?: string;
  battleDelaySeconds?: string;
  agentMaxCurrentCount?: string;
  agentMaxLifetimeCount?: string;
}

interface BuildWorldConfigForFactoryInput {
  baseConfig: FactoryConfigLike;
  defaults: FactoryWorldConfigDefaults;
  overrides: FactoryWorldConfigOverrides;
}

interface FactoryConfigLike {
  factory_address?: string;
  dev?: { mode?: { on?: boolean } };
  season?: {
    startMainAt?: number;
    startSettlingAt?: number;
    durationSeconds?: number;
    bridgeCloseAfterEndSeconds?: number;
    pointRegistrationCloseAfterEndSeconds?: number;
  };
  blitz?: {
    mode?: { on?: boolean };
    registration?: {
      fee_amount?: bigint;
      fee_token?: string;
      fee_recipient?: string;
      registration_count_max?: number;
      registration_delay_seconds?: number;
      registration_period_seconds?: number;
    };
  };
  settlement?: {
    center?: number;
    base_distance?: number;
    subsequent_distance?: number;
    single_realm_mode?: boolean;
    two_player_mode?: boolean;
  };
  trade?: {
    maxCount?: number;
  };
  battle?: {
    delaySeconds?: number;
    graceTickCount?: number;
    graceTickCountHyp?: number;
  };
  agent?: {
    max_current_count?: number;
    max_lifetime_count?: number;
  };
  mmr?: {
    enabled?: boolean;
  };
  [key: string]: unknown;
}

type FactorySeasonConfig = NonNullable<FactoryConfigLike["season"]>;
type FactoryBlitzConfig = NonNullable<FactoryConfigLike["blitz"]>;
type FactoryBlitzRegistrationConfig = NonNullable<FactoryBlitzConfig["registration"]>;
type FactorySettlementConfig = NonNullable<FactoryConfigLike["settlement"]>;
type FactoryTradeConfig = NonNullable<FactoryConfigLike["trade"]>;
type FactoryBattleConfig = NonNullable<FactoryConfigLike["battle"]>;
type FactoryAgentConfig = NonNullable<FactoryConfigLike["agent"]>;

const hasValue = (value?: string): boolean => value !== undefined && value.trim() !== "";

const parseNonNegativeNumber = (value: string, label: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return parsed;
};

const parseInteger = (value: string, label: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer`);
  }
  return parsed;
};

const resolveNonNegativeNumberOverride = (
  value: string | undefined,
  label: string,
  fallback: number | undefined,
): number | undefined => {
  if (!hasValue(value)) {
    return fallback;
  }

  return parseNonNegativeNumber(value!, label);
};

const resolveFactoryDurationSeconds = (
  defaults: FactoryWorldConfigDefaults,
  overrides: FactoryWorldConfigOverrides,
): number => {
  const durationHours = hasValue(overrides.durationHours)
    ? parseNonNegativeNumber(overrides.durationHours!, "Duration hours")
    : Number(defaults.durationHours || 0);

  const durationMinutes = hasValue(overrides.durationMinutes)
    ? parseNonNegativeNumber(overrides.durationMinutes!, "Duration minutes")
    : Number(defaults.baseDurationMinutes || 0);

  if (!Number.isFinite(durationMinutes) || durationMinutes < 0 || durationMinutes > 59) {
    throw new Error("Duration minutes must be between 0 and 59");
  }

  return Math.max(60, Math.max(0, durationHours) * 3600 + Math.max(0, durationMinutes) * 60);
};

const resolveBlitzFeePrecision = (
  defaults: FactoryWorldConfigDefaults,
  overrides: FactoryWorldConfigOverrides,
): number => {
  const precision = hasValue(overrides.blitzFeePrecision)
    ? parseInteger(overrides.blitzFeePrecision!, "Fee precision")
    : (defaults.defaultBlitzRegistration.precision ?? DEFAULT_TOKEN_PRECISION);

  if (precision < 0) {
    throw new Error("Fee precision must be a non-negative integer");
  }

  return precision;
};

const resolveBlitzFeeAmount = (
  baseConfig: FactoryConfigLike,
  defaults: FactoryWorldConfigDefaults,
  overrides: FactoryWorldConfigOverrides,
): bigint | undefined => {
  const precision = resolveBlitzFeePrecision(defaults, overrides);
  const amountToParse = hasValue(overrides.blitzFeeAmount)
    ? overrides.blitzFeeAmount!.trim()
    : defaults.defaultBlitzRegistration.amount;

  if (!amountToParse) {
    return baseConfig.blitz?.registration?.fee_amount;
  }

  return BigInt(parseTokenAmountToIntegerString(amountToParse, precision, "Fee amount"));
};

const resolveSeasonConfig = (
  baseConfig: FactoryConfigLike,
  overrides: FactoryWorldConfigOverrides,
  durationSeconds: number,
): FactorySeasonConfig => ({
  ...(baseConfig.season || {}),
  startMainAt: overrides.startMainAt ?? baseConfig.season?.startMainAt,
  startSettlingAt: overrides.startSettlingAt ?? baseConfig.season?.startSettlingAt,
  durationSeconds,
  bridgeCloseAfterEndSeconds: resolveNonNegativeNumberOverride(
    overrides.seasonBridgeCloseAfterEndSeconds,
    "Bridge close after end seconds",
    baseConfig.season?.bridgeCloseAfterEndSeconds,
  ),
  pointRegistrationCloseAfterEndSeconds: resolveNonNegativeNumberOverride(
    overrides.seasonPointRegistrationCloseAfterEndSeconds,
    "Point registration close after end seconds",
    baseConfig.season?.pointRegistrationCloseAfterEndSeconds,
  ),
});

const resolveBlitzModeOn = (baseConfig: FactoryConfigLike, overrides: FactoryWorldConfigOverrides): boolean =>
  overrides.gameMode ? overrides.gameMode === "blitz" : (baseConfig.blitz?.mode?.on ?? true);

const resolveBlitzRegistrationConfig = (
  baseConfig: FactoryConfigLike,
  defaults: FactoryWorldConfigDefaults,
  overrides: FactoryWorldConfigOverrides,
): FactoryBlitzRegistrationConfig => ({
  ...(baseConfig.blitz?.registration || {}),
  fee_amount: resolveBlitzFeeAmount(baseConfig, defaults, overrides),
  fee_token:
    overrides.blitzFeeToken?.trim() ||
    defaults.defaultBlitzRegistration.token ||
    baseConfig.blitz?.registration?.fee_token,
  fee_recipient: overrides.blitzFeeRecipient?.trim() || baseConfig.blitz?.registration?.fee_recipient,
  registration_count_max: resolveNonNegativeNumberOverride(
    overrides.registrationCountMax,
    "Registration count max",
    24,
  ),
  registration_delay_seconds: resolveNonNegativeNumberOverride(
    overrides.registrationDelaySeconds,
    "Registration delay seconds",
    baseConfig.blitz?.registration?.registration_delay_seconds,
  ),
  registration_period_seconds: resolveNonNegativeNumberOverride(
    overrides.registrationPeriodSeconds,
    "Registration period seconds",
    baseConfig.blitz?.registration?.registration_period_seconds,
  ),
});

const resolveSettlementConfig = (
  baseConfig: FactoryConfigLike,
  overrides: FactoryWorldConfigOverrides,
): FactorySettlementConfig => {
  const singleRealmMode = overrides.singleRealmMode ?? baseConfig.settlement?.single_realm_mode ?? false;
  const twoPlayerMode = overrides.twoPlayerMode ?? baseConfig.settlement?.two_player_mode ?? false;

  if (singleRealmMode && twoPlayerMode) {
    throw new Error("single_realm_mode and two_player_mode cannot both be enabled");
  }

  return {
    ...(baseConfig.settlement || {}),
    center: resolveNonNegativeNumberOverride(
      overrides.settlementCenter,
      "Settlement center",
      baseConfig.settlement?.center,
    ),
    base_distance: resolveNonNegativeNumberOverride(
      overrides.settlementBaseDistance,
      "Settlement base distance",
      baseConfig.settlement?.base_distance,
    ),
    subsequent_distance: resolveNonNegativeNumberOverride(
      overrides.settlementSubsequentDistance,
      "Settlement subsequent distance",
      baseConfig.settlement?.subsequent_distance,
    ),
    single_realm_mode: singleRealmMode,
    two_player_mode: twoPlayerMode,
  };
};

const resolveTradeConfig = (
  baseConfig: FactoryConfigLike,
  overrides: FactoryWorldConfigOverrides,
): FactoryTradeConfig => ({
  ...(baseConfig.trade || {}),
  maxCount: resolveNonNegativeNumberOverride(overrides.tradeMaxCount, "Trade max count", baseConfig.trade?.maxCount),
});

const resolveBattleConfig = (
  baseConfig: FactoryConfigLike,
  overrides: FactoryWorldConfigOverrides,
): FactoryBattleConfig => ({
  ...(baseConfig.battle || {}),
  delaySeconds: resolveNonNegativeNumberOverride(
    overrides.battleDelaySeconds,
    "Battle delay seconds",
    baseConfig.battle?.delaySeconds,
  ),
  graceTickCount: resolveNonNegativeNumberOverride(
    overrides.battleGraceTickCount,
    "Battle grace tick count",
    baseConfig.battle?.graceTickCount,
  ),
  graceTickCountHyp: resolveNonNegativeNumberOverride(
    overrides.battleGraceTickCountHyp,
    "Battle hyperstructure grace tick count",
    baseConfig.battle?.graceTickCountHyp,
  ),
});

const resolveAgentConfig = (
  baseConfig: FactoryConfigLike,
  overrides: FactoryWorldConfigOverrides,
): FactoryAgentConfig => ({
  ...(baseConfig.agent || {}),
  max_current_count: resolveNonNegativeNumberOverride(
    overrides.agentMaxCurrentCount,
    "Agent max current count",
    baseConfig.agent?.max_current_count,
  ),
  max_lifetime_count: resolveNonNegativeNumberOverride(
    overrides.agentMaxLifetimeCount,
    "Agent max lifetime count",
    baseConfig.agent?.max_lifetime_count,
  ),
});

export const buildWorldConfigForFactory = ({
  baseConfig,
  defaults,
  overrides,
}: BuildWorldConfigForFactoryInput): FactoryConfigLike => {
  const durationSeconds = resolveFactoryDurationSeconds(defaults, overrides);
  const seasonConfig = resolveSeasonConfig(baseConfig, overrides, durationSeconds);
  const blitzRegistrationConfig = resolveBlitzRegistrationConfig(baseConfig, defaults, overrides);
  const settlementConfig = resolveSettlementConfig(baseConfig, overrides);
  const tradeConfig = resolveTradeConfig(baseConfig, overrides);
  const battleConfig = resolveBattleConfig(baseConfig, overrides);
  const agentConfig = resolveAgentConfig(baseConfig, overrides);

  return {
    ...baseConfig,
    factory_address: overrides.factoryAddress?.trim() || defaults.factoryAddress,
    dev: {
      ...(baseConfig.dev || {}),
      mode: {
        ...(baseConfig.dev?.mode || {}),
        on: overrides.devModeOn ?? defaults.devModeOn,
      },
    },
    season: {
      ...seasonConfig,
    },
    blitz: {
      ...(baseConfig.blitz || {}),
      mode: {
        ...(baseConfig.blitz?.mode || {}),
        on: resolveBlitzModeOn(baseConfig, overrides),
      },
      registration: blitzRegistrationConfig,
    },
    settlement: settlementConfig,
    trade: tradeConfig,
    battle: battleConfig,
    agent: agentConfig,
    mmr: {
      ...(baseConfig.mmr || {}),
      enabled: overrides.mmrEnabled ?? defaults.mmrEnabledOn,
    },
  };
};
