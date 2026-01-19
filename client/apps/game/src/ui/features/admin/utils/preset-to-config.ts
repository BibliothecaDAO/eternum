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

/**
 * Calculate the next hour from now (for default start time)
 */
export const getNextHourEpoch = (): number => {
  const now = Date.now();
  const nextHourMs = Math.ceil(now / 3600000) * 3600000;
  return Math.floor(nextHourMs / 1000);
};

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
  const effectiveStartTime = startTime > 0 ? Math.max(startTime, nowSec) : getNextHourEpoch();

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
      },
    },

    // Settlement - single_realm_mode is a core game mode setting
    settlement: {
      ...baseConfig.settlement,
      single_realm_mode: effectiveOverrides.singleRealmMode,
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
