import type { Config as EternumConfig } from "@bibliothecadao/types";
import type { GamePreset, GamePresetConfigOverrides } from "../types/game-presets";
import { getDefaultBlitzRegistrationConfig } from "../constants";
import type { ChainType } from "./manifest-loader";

/**
 * Parse a decimal string to BigInt with given precision
 */
const parseDecimalToBigInt = (value: string, precision: number): bigint => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0") return BigInt(0);

  const normalized = trimmed.startsWith(".") ? `0${trimmed}` : trimmed;
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return BigInt(0);
  }

  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > precision) {
    // Truncate if too many decimals
    const truncatedFraction = fraction.slice(0, precision);
    const combined = `${whole}${truncatedFraction}`.replace(/^0+(?=\d)/, "");
    return BigInt(combined || "0");
  }

  const paddedFraction = fraction.padEnd(precision, "0");
  const combined = `${whole}${precision > 0 ? paddedFraction : ""}`.replace(/^0+(?=\d)/, "");
  return BigInt(combined || "0");
};

export const isValidDecimalAmount = (value: string, precision: number): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const normalized = trimmed.startsWith(".") ? `0${trimmed}` : trimmed;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return false;
  const [, fraction = ""] = normalized.split(".");
  return fraction.length <= precision;
};

/**
 * Calculate the next hour from now (for default start time)
 */
export const getNextHourEpoch = (): number => {
  const now = Date.now();
  const nextHourMs = Math.ceil(now / 3600000) * 3600000;
  return Math.floor(nextHourMs / 1000);
};

const MAX_START_TIME_SECONDS = 7 * 24 * 60 * 60;

/**
 * Apply preset configuration overrides to base Eternum config.
 *
 * IMPORTANT: This function is conservative - it only overrides fields that
 * truly need to change for the game mode. All other fields are preserved
 * from baseConfig (ETERNUM_CONFIG). This approach matches the working
 * implementation from the next branch.
 */
export const applyPresetToConfig = (
  baseConfig: EternumConfig,
  preset: GamePreset,
  customOverrides: Partial<GamePresetConfigOverrides>,
  chain: ChainType,
  startTime: number, // epoch seconds, 0 = use next hour
): EternumConfig => {
  const effectiveOverrides: GamePresetConfigOverrides = {
    ...preset.configOverrides,
    ...customOverrides,
  };

  const blitzDefaults = getDefaultBlitzRegistrationConfig(chain);

  // Calculate duration in seconds
  const durationSeconds = effectiveOverrides.durationHours * 3600 + effectiveOverrides.durationMinutes * 60;

  // Calculate start time
  const nowSec = Math.floor(Date.now() / 1000);
  const maxAllowed = nowSec + MAX_START_TIME_SECONDS;
  const effectiveStartTime =
    startTime > 0 ? Math.min(Math.max(startTime, nowSec), maxAllowed) : Math.min(getNextHourEpoch(), maxAllowed);

  if (effectiveOverrides.hasFee && !isValidDecimalAmount(effectiveOverrides.feeAmount, effectiveOverrides.feePrecision)) {
    throw new Error(`Invalid fee amount. Use up to ${effectiveOverrides.feePrecision} decimals.`);
  }

  // Calculate fee amount - only if fees are enabled
  const feeAmount = effectiveOverrides.hasFee
    ? parseDecimalToBigInt(effectiveOverrides.feeAmount || blitzDefaults.amount, effectiveOverrides.feePrecision)
    : BigInt(0);

  // Determine fee token: use override if provided, otherwise chain default, otherwise preserve baseConfig
  const feeToken =
    blitzDefaults.token || (baseConfig.blitz?.registration?.fee_token as string) || blitzDefaults.token;

  // Build the config - ONLY override fields that need to change for the game mode
  // Preserve everything else from baseConfig to match ETERNUM_CONFIG values
  return {
    ...baseConfig,

    // Dev mode - this is a core game mode setting
    dev: {
      ...(baseConfig as any).dev,
      mode: {
        ...((baseConfig as any).dev?.mode || {}),
        on: effectiveOverrides.devMode,
      },
    },

    // Season timing - core game mode settings
    season: {
      ...baseConfig.season,
      durationSeconds: Math.max(60, durationSeconds),
      startMainAt: effectiveStartTime,
      startSettlingAfterSeconds: effectiveOverrides.startSettlingAfterSeconds,
      bridgeCloseAfterEndSeconds: effectiveOverrides.bridgeCloseAfterEndSeconds,
      pointRegistrationCloseAfterEndSeconds: effectiveOverrides.pointRegistrationCloseAfterEndSeconds,
    },

    // Blitz / Registration - core game mode settings
    blitz: {
      ...baseConfig.blitz,
      mode: {
        ...(baseConfig.blitz?.mode || {}),
        on: effectiveOverrides.hasFee,
      },
      registration: {
        ...baseConfig.blitz?.registration,
        fee_amount: feeAmount,
        fee_token: feeToken,
        registration_count_max: effectiveOverrides.registrationCountMax,
        registration_delay_seconds: effectiveOverrides.registrationDelaySeconds,
        registration_period_seconds: effectiveOverrides.registrationPeriodSeconds,
      },
    },

    // Battle settings
    battle: {
      ...baseConfig.battle,
      graceTickCount: effectiveOverrides.battleGraceTickCount,
      graceTickCountHyp: effectiveOverrides.battleGraceTickCountHyp,
      delaySeconds: effectiveOverrides.battleDelaySeconds,
    },

    // Tick intervals
    tick: {
      ...baseConfig.tick,
      defaultTickIntervalInSeconds: effectiveOverrides.defaultTickIntervalSeconds,
      armiesTickIntervalInSeconds: effectiveOverrides.armiesTickIntervalSeconds,
      deliveryTickIntervalInSeconds: effectiveOverrides.deliveryTickIntervalSeconds,
    },

    // Movement & speed
    speed: {
      ...baseConfig.speed,
      donkey: effectiveOverrides.speedDonkey,
      army: effectiveOverrides.speedArmy,
    },

    // Exploration settings
    exploration: {
      ...baseConfig.exploration,
      reward: effectiveOverrides.explorationReward,
      shardsMinesFailProbability: effectiveOverrides.shardsMinesFailProbability,
      shardsMinesWinProbability: effectiveOverrides.shardsMinesWinProbability,
      agentFindProbability: effectiveOverrides.agentFindProbability,
      agentFindFailProbability: effectiveOverrides.agentFindFailProbability,
      villageFindProbability: effectiveOverrides.villageFindProbability,
      villageFindFailProbability: effectiveOverrides.villageFindFailProbability,
      hyperstructureWinProbAtCenter: effectiveOverrides.hyperstructureWinProbAtCenter,
      hyperstructureFailProbAtCenter: effectiveOverrides.hyperstructureFailProbAtCenter,
      questFindProbability: effectiveOverrides.questFindProbability,
      questFindFailProbability: effectiveOverrides.questFindFailProbability,
    },

    // Troop settings
    troop: {
      ...baseConfig.troop,
      stamina: {
        ...(baseConfig.troop?.stamina || {}),
        staminaGainPerTick: effectiveOverrides.staminaGainPerTick,
        staminaInitial: effectiveOverrides.staminaInitial,
        staminaBonusValue: effectiveOverrides.staminaBonusValue,
        staminaKnightMax: effectiveOverrides.staminaKnightMax,
        staminaPaladinMax: effectiveOverrides.staminaPaladinMax,
        staminaCrossbowmanMax: effectiveOverrides.staminaCrossbowmanMax,
        staminaAttackReq: effectiveOverrides.staminaAttackReq,
        staminaDefenseReq: effectiveOverrides.staminaDefenseReq,
        staminaExploreWheatCost: effectiveOverrides.staminaExploreWheatCost,
        staminaExploreFishCost: effectiveOverrides.staminaExploreFishCost,
        staminaExploreStaminaCost: effectiveOverrides.staminaExploreStaminaCost,
        staminaTravelWheatCost: effectiveOverrides.staminaTravelWheatCost,
        staminaTravelFishCost: effectiveOverrides.staminaTravelFishCost,
        staminaTravelStaminaCost: effectiveOverrides.staminaTravelStaminaCost,
      },
      limit: {
        ...(baseConfig.troop?.limit || {}),
        explorerMaxPartyCount: effectiveOverrides.explorerMaxPartyCount,
        explorerAndGuardMaxTroopCount: effectiveOverrides.explorerAndGuardMaxTroopCount,
        guardResurrectionDelay: effectiveOverrides.guardResurrectionDelay,
        mercenariesTroopLowerBound: effectiveOverrides.mercenariesTroopLowerBound,
        mercenariesTroopUpperBound: effectiveOverrides.mercenariesTroopUpperBound,
      },
    },

    // Settlement - single_realm_mode is a core game mode setting
    settlement: {
      ...baseConfig.settlement,
      center: effectiveOverrides.settlementCenter,
      base_distance: effectiveOverrides.settlementBaseDistance,
      subsequent_distance: effectiveOverrides.settlementSubsequentDistance,
      single_realm_mode: effectiveOverrides.singleRealmMode,
    },

    // Population
    populationCapacity: {
      ...baseConfig.populationCapacity,
      basePopulation: effectiveOverrides.basePopulation,
    },

    // Trade
    trade: {
      ...baseConfig.trade,
      maxCount: effectiveOverrides.tradeMaxCount,
    },
  } as EternumConfig;
};

/**
 * Format epoch seconds to datetime-local input value
 */
export const formatDateTimeLocal = (epochSeconds: number): string => {
  if (!epochSeconds || epochSeconds <= 0) {
    // Default to next hour
    const nextHour = new Date(getNextHourEpoch() * 1000);
    return formatDate(nextHour);
  }
  return formatDate(new Date(epochSeconds * 1000));
};

const formatDate = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

/**
 * Parse datetime-local input value to epoch seconds
 */
export const parseDateTimeLocal = (value: string): number => {
  if (!value) return 0;
  return Math.floor(new Date(value).getTime() / 1000);
};
