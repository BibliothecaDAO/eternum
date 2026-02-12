export interface BlitzRegistrationDefaults {
  amount: string;
  precision: number;
  token: string;
}

export interface FactoryWorldConfigDefaults {
  factoryAddress: string;
  devModeOn: boolean;
  mmrEnabledOn: boolean;
  durationHours: number;
  baseDurationMinutes: number;
  defaultBlitzRegistration: BlitzRegistrationDefaults;
}

export interface FactoryWorldConfigOverrides {
  startMainAt?: number;
  startSettlingAt?: number;
  devModeOn?: boolean;
  mmrEnabled?: boolean;
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

const parseDecimalToBigInt = (value: string, precision: number): bigint => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Fee amount is required");
  const normalized = trimmed.startsWith(".") ? `0${trimmed}` : trimmed;
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Fee amount must be a number");
  }
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > precision) {
    throw new Error(`Fee amount has more than ${precision} decimals`);
  }
  const paddedFraction = fraction.padEnd(precision, "0");
  const combined = `${whole}${precision > 0 ? paddedFraction : ""}`.replace(/^0+(?=\d)/, "");
  return BigInt(combined || "0");
};

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

export const buildWorldConfigForFactory = ({
  baseConfig,
  defaults,
  overrides,
}: BuildWorldConfigForFactoryInput): FactoryConfigLike => {
  const durationHours = hasValue(overrides.durationHours)
    ? parseNonNegativeNumber(overrides.durationHours!, "Duration hours")
    : Number(defaults.durationHours || 0);

  const durationMinutes = hasValue(overrides.durationMinutes)
    ? parseNonNegativeNumber(overrides.durationMinutes!, "Duration minutes")
    : Number(defaults.baseDurationMinutes || 0);

  if (!Number.isFinite(durationMinutes) || durationMinutes < 0 || durationMinutes > 59) {
    throw new Error("Duration minutes must be between 0 and 59");
  }

  const precision = hasValue(overrides.blitzFeePrecision)
    ? parseInteger(overrides.blitzFeePrecision!, "Fee precision")
    : defaults.defaultBlitzRegistration.precision;

  if (precision < 0) {
    throw new Error("Fee precision must be a non-negative integer");
  }

  const amountToParse = hasValue(overrides.blitzFeeAmount)
    ? overrides.blitzFeeAmount!.trim()
    : defaults.defaultBlitzRegistration.amount;

  const blitzFeeAmount = amountToParse
    ? parseDecimalToBigInt(amountToParse, precision)
    : baseConfig.blitz?.registration?.fee_amount;

  const registrationCountMax = hasValue(overrides.registrationCountMax)
    ? parseNonNegativeNumber(overrides.registrationCountMax!, "Registration count max")
    : 30;

  const registrationDelaySeconds = hasValue(overrides.registrationDelaySeconds)
    ? parseNonNegativeNumber(overrides.registrationDelaySeconds!, "Registration delay seconds")
    : baseConfig.blitz?.registration?.registration_delay_seconds;

  const registrationPeriodSeconds = hasValue(overrides.registrationPeriodSeconds)
    ? parseNonNegativeNumber(overrides.registrationPeriodSeconds!, "Registration period seconds")
    : baseConfig.blitz?.registration?.registration_period_seconds;

  const bridgeCloseAfterEndSeconds = hasValue(overrides.seasonBridgeCloseAfterEndSeconds)
    ? parseNonNegativeNumber(overrides.seasonBridgeCloseAfterEndSeconds!, "Bridge close after end seconds")
    : baseConfig.season?.bridgeCloseAfterEndSeconds;

  const pointRegistrationCloseAfterEndSeconds = hasValue(overrides.seasonPointRegistrationCloseAfterEndSeconds)
    ? parseNonNegativeNumber(
        overrides.seasonPointRegistrationCloseAfterEndSeconds!,
        "Point registration close after end seconds",
      )
    : baseConfig.season?.pointRegistrationCloseAfterEndSeconds;

  const settlementCenter = hasValue(overrides.settlementCenter)
    ? parseNonNegativeNumber(overrides.settlementCenter!, "Settlement center")
    : baseConfig.settlement?.center;

  const settlementBaseDistance = hasValue(overrides.settlementBaseDistance)
    ? parseNonNegativeNumber(overrides.settlementBaseDistance!, "Settlement base distance")
    : baseConfig.settlement?.base_distance;

  const settlementSubsequentDistance = hasValue(overrides.settlementSubsequentDistance)
    ? parseNonNegativeNumber(overrides.settlementSubsequentDistance!, "Settlement subsequent distance")
    : baseConfig.settlement?.subsequent_distance;

  const tradeMaxCount = hasValue(overrides.tradeMaxCount)
    ? parseNonNegativeNumber(overrides.tradeMaxCount!, "Trade max count")
    : baseConfig.trade?.maxCount;

  const battleGraceTickCount = hasValue(overrides.battleGraceTickCount)
    ? parseNonNegativeNumber(overrides.battleGraceTickCount!, "Battle grace tick count")
    : baseConfig.battle?.graceTickCount;

  const battleGraceTickCountHyp = hasValue(overrides.battleGraceTickCountHyp)
    ? parseNonNegativeNumber(overrides.battleGraceTickCountHyp!, "Battle hyperstructure grace tick count")
    : baseConfig.battle?.graceTickCountHyp;

  const battleDelaySeconds = hasValue(overrides.battleDelaySeconds)
    ? parseNonNegativeNumber(overrides.battleDelaySeconds!, "Battle delay seconds")
    : baseConfig.battle?.delaySeconds;

  const agentMaxCurrentCount = hasValue(overrides.agentMaxCurrentCount)
    ? parseNonNegativeNumber(overrides.agentMaxCurrentCount!, "Agent max current count")
    : baseConfig.agent?.max_current_count;

  const agentMaxLifetimeCount = hasValue(overrides.agentMaxLifetimeCount)
    ? parseNonNegativeNumber(overrides.agentMaxLifetimeCount!, "Agent max lifetime count")
    : baseConfig.agent?.max_lifetime_count;

  const durationSeconds = Math.max(60, Math.max(0, durationHours) * 3600 + Math.max(0, durationMinutes) * 60);

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
      ...(baseConfig.season || {}),
      startMainAt: overrides.startMainAt ?? baseConfig.season?.startMainAt,
      startSettlingAt: overrides.startSettlingAt ?? baseConfig.season?.startSettlingAt,
      durationSeconds,
      bridgeCloseAfterEndSeconds,
      pointRegistrationCloseAfterEndSeconds,
    },
    blitz: {
      ...(baseConfig.blitz || {}),
      registration: {
        ...(baseConfig.blitz?.registration || {}),
        fee_amount: blitzFeeAmount,
        fee_token: overrides.blitzFeeToken?.trim() || defaults.defaultBlitzRegistration.token || baseConfig.blitz?.registration?.fee_token,
        fee_recipient: overrides.blitzFeeRecipient?.trim() || baseConfig.blitz?.registration?.fee_recipient,
        registration_count_max: registrationCountMax,
        registration_delay_seconds: registrationDelaySeconds,
        registration_period_seconds: registrationPeriodSeconds,
      },
    },
    settlement: {
      ...(baseConfig.settlement || {}),
      center: settlementCenter,
      base_distance: settlementBaseDistance,
      subsequent_distance: settlementSubsequentDistance,
      single_realm_mode: overrides.singleRealmMode ?? baseConfig.settlement?.single_realm_mode,
    },
    trade: {
      ...(baseConfig.trade || {}),
      maxCount: tradeMaxCount,
    },
    battle: {
      ...(baseConfig.battle || {}),
      delaySeconds: battleDelaySeconds,
      graceTickCount: battleGraceTickCount,
      graceTickCountHyp: battleGraceTickCountHyp,
    },
    agent: {
      ...(baseConfig.agent || {}),
      max_current_count: agentMaxCurrentCount,
      max_lifetime_count: agentMaxLifetimeCount,
    },
    mmr: {
      ...(baseConfig.mmr || {}),
      enabled: overrides.mmrEnabled ?? defaults.mmrEnabledOn,
    },
  };
};
