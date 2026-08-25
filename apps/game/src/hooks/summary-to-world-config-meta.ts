/**
 * Adapter mapping the centralized `WorldSummary` bulk payload into the legacy
 * `WorldConfigMeta` shape consumed by the card grid and registration hooks.
 *
 * The server-side `/api/worlds/summary` endpoint now produces all per-world
 * configuration (timing, mode, counters, addresses, prize distribution)
 * in a single call, replacing the legacy per-world fan-out. Player-scoped
 * fields (`isPlayerRegistered`, `hasPlayerSettledRealm`) are not part of the
 * bulk payload — callers layer those in via a separate, gated query.
 *
 * The jackpot balance is resolved server-side (one RPC call per world per
 * poll cycle) and carried on the summary as `winnerJackpotAmount`. When the
 * server hasn't provided it (null), callers fall back to the on-demand
 * `useWorldJackpot` RPC lookup via `prizeDistributionAddress`.
 */
import type { WorldSummary } from "@bibliothecadao/types";
import type { ResolvedGameMode } from "@/config/game-modes/resolved-mode";
import type { WorldConfigMeta } from "./use-world-availability";

interface PlayerRegistrationFields {
  isPlayerRegistered: boolean | null;
  hasPlayerSettledRealm: boolean | null;
}

const resolveMode = (summaryMode: WorldSummary["mode"]): ResolvedGameMode => {
  if (summaryMode === "blitz") return "blitz";
  if (summaryMode === "eternum") return "eternum";
  return "unknown";
};

const parseSummaryBigInt = (value: string | null): bigint => {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const parseNullableSummaryBigInt = (value: string | null): bigint | null => {
  if (value == null) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

/**
 * Map a `WorldSummary` payload into the legacy `WorldConfigMeta` shape.
 *
 * Player-specific fields must be passed explicitly; this function does not
 * fetch anything. Jackpot is mapped from the server-resolved summary value;
 * null means the server didn't provide one and callers may fall back to
 * `useWorldJackpot`.
 */
export const summaryToWorldConfigMeta = (
  summary: WorldSummary,
  playerRegistration: PlayerRegistrationFields | null,
): WorldConfigMeta => {
  const mode = resolveMode(summary.mode);
  const startMainAt = summary.startMainAt ?? null;
  const endAt = summary.endAt ?? null;
  const seasonDurationSeconds =
    startMainAt != null && endAt != null && endAt >= startMainAt ? endAt - startMainAt : null;

  return {
    mode,
    worldId: summary.worldId ?? null,
    gameId: summary.gameId ?? null,
    startSettlingAt: summary.startSettlingAt ?? null,
    startMainAt,
    endAt,
    seasonDurationSeconds,
    // Eternum spacing config — not part of summary yet; defaulted to null.
    settlementBaseDistance: null,
    spiresLayerDistance: null,
    spiresMaxCount: null,
    spiresSettledCount: null,
    settlementLayerMax: null,
    settlementLayersSkipped: null,
    mapCenterOffset: null,
    seasonPassAddress: summary.seasonPassAddress ?? null,
    villagePassAddress: summary.villagePassAddress ?? null,
    registrationCount: summary.registrationCount ?? null,
    registrationCountMax: summary.registrationCountMax ?? null,
    singleRealmMode: summary.singleRealmMode ?? false,
    twoPlayerMode: summary.twoPlayerMode ?? false,
    entryTokenAddress: summary.entryTokenAddress ?? null,
    feeTokenAddress: summary.feeTokenAddress ?? null,
    feeAmount: parseSummaryBigInt(summary.feeAmount),
    registrationStartAt: summary.registrationStartAt ?? null,
    registrationEndAt: summary.registrationEndAt ?? summary.startMainAt ?? null,
    mmrEnabled: summary.mmrEnabled ?? false,
    devModeOn: summary.devModeOn ?? false,
    isPlayerRegistered: playerRegistration?.isPlayerRegistered ?? null,
    hasPlayerSettledRealm: playerRegistration?.hasPlayerSettledRealm ?? null,
    settledPlayersCount: summary.settledPlayersCount ?? null,
    settledRealmsCount: summary.settledRealmsCount ?? null,
    settledVillagesCount: summary.settledVillagesCount ?? null,
    prizeDistributionAddress: summary.prizeDistributionAddress ?? null,
    winnerJackpotAmount: parseNullableSummaryBigInt(summary.winnerJackpotAmount),
  };
};
