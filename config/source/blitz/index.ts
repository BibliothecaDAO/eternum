import type { Config } from "../../../packages/types/src/types/common";
import { mergeConfigPatches } from "../common/merge-config";
import { blitzBaseConfig } from "./base";
import { official60BlitzProfile } from "./official-60";
import { official90BlitzProfile } from "./official-90";
import { type BlitzBalanceProfile, type BlitzBalanceProfileId } from "./shared";
import { OFFICIAL_60_BLITZ_DURATION_MINUTES, OFFICIAL_60_BLITZ_DURATION_SECONDS } from "./official-60";
import { OFFICIAL_90_BLITZ_DURATION_MINUTES, OFFICIAL_90_BLITZ_DURATION_SECONDS } from "./official-90";

const BLITZ_BALANCE_PROFILES: Record<BlitzBalanceProfileId, BlitzBalanceProfile> = {
  "official-60": official60BlitzProfile,
  "official-90": official90BlitzProfile,
};

export const BLITZ_OFFICIAL_DURATION_MINUTES = {
  "official-60": OFFICIAL_60_BLITZ_DURATION_MINUTES,
  "official-90": OFFICIAL_90_BLITZ_DURATION_MINUTES,
} as const;

function isOfficialDuration(duration: number | null | undefined, expectedDuration: number): boolean {
  return Number.isFinite(duration) && duration === expectedDuration;
}

export function resolveBlitzBalanceProfileIdFromDurationMinutes(durationMinutes: number | null | undefined) {
  if (isOfficialDuration(durationMinutes, OFFICIAL_60_BLITZ_DURATION_MINUTES)) {
    return "official-60" as const;
  }

  if (isOfficialDuration(durationMinutes, OFFICIAL_90_BLITZ_DURATION_MINUTES)) {
    return "official-90" as const;
  }

  return null;
}

export function resolveBlitzBalanceProfileIdFromDurationSeconds(durationSeconds: number | null | undefined) {
  if (isOfficialDuration(durationSeconds, OFFICIAL_60_BLITZ_DURATION_SECONDS)) {
    return "official-60" as const;
  }

  if (isOfficialDuration(durationSeconds, OFFICIAL_90_BLITZ_DURATION_SECONDS)) {
    return "official-90" as const;
  }

  return null;
}

export function applyBlitzBalanceProfile<T extends Config>(config: T, profileId: BlitzBalanceProfileId): T {
  return mergeConfigPatches<T>(config as never, BLITZ_BALANCE_PROFILES[profileId] as never);
}

export { blitzBaseConfig };
export type { BlitzBalanceProfileId };
