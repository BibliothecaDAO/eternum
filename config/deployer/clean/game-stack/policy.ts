import type { BlitzLaunchQuote, PublicBlitzPresetId } from "./types";

const PROVISIONING_LEAD_TIME_MS = 2 * 60 * 60 * 1_000;
const READINESS_MARGIN_MS = 15 * 60 * 1_000;
const QUOTE_LIFETIME_MS = 30 * 60 * 1_000;
const HOUR_MS = 60 * 60 * 1_000;

const PUBLIC_BLITZ_PRESETS: Record<PublicBlitzPresetId, { durationSeconds: number; twoPlayerMode: boolean }> = {
  "blitz-fast": { durationSeconds: 60 * 60, twoPlayerMode: false },
  "blitz-open": { durationSeconds: 90 * 60, twoPlayerMode: false },
  "blitz-duel": { durationSeconds: 90 * 60, twoPlayerMode: true },
};

export interface CreateBlitzLaunchQuoteRequest {
  quoteId: string;
  requesterWallet: string;
  presetId: string;
  now?: Date;
}

export function createBlitzLaunchQuote(request: CreateBlitzLaunchQuoteRequest): BlitzLaunchQuote {
  const now = request.now ?? new Date();
  const preset = resolvePublicBlitzPreset(request.presetId);
  const intendedStart = resolveNextSafeWholeHour(now);
  const intendedEnd = new Date(intendedStart.getTime() + preset.durationSeconds * 1_000);

  return {
    schemaVersion: 1,
    quoteId: request.quoteId,
    requesterWallet: request.requesterWallet,
    presetId: request.presetId as PublicBlitzPresetId,
    durationSeconds: preset.durationSeconds,
    twoPlayerMode: preset.twoPlayerMode,
    intendedStart: intendedStart.toISOString(),
    intendedEnd: intendedEnd.toISOString(),
    readinessDeadline: new Date(intendedStart.getTime() - READINESS_MARGIN_MS).toISOString(),
    expiresAt: new Date(now.getTime() + QUOTE_LIFETIME_MS).toISOString(),
  };
}

function resolvePublicBlitzPreset(presetId: string): (typeof PUBLIC_BLITZ_PRESETS)[PublicBlitzPresetId] {
  const preset = PUBLIC_BLITZ_PRESETS[presetId as PublicBlitzPresetId];
  if (!preset) {
    throw new Error(`Blitz preset "${presetId}" is not approved for public production launches`);
  }
  return preset;
}

function resolveNextSafeWholeHour(now: Date): Date {
  const earliestStart = now.getTime() + PROVISIONING_LEAD_TIME_MS;
  return new Date(Math.ceil(earliestStart / HOUR_MS) * HOUR_MS);
}
