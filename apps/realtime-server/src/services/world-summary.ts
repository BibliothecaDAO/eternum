import { type WorldSummary, type WorldSummaryMode } from "@bibliothecadao/types";
import { resolveToriiSqlUrl } from "../config/endpoints";
import { encodePaddedFeltAscii } from "./factory-sql";

const ZERO_OWNER_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";

type SummaryFields = Omit<WorldSummary, "name" | "chain" | "alive" | "lastCheckedAt">;

const NULL_SUMMARY: SummaryFields = {
  mode: null,
  startSettlingAt: null,
  startMainAt: null,
  endAt: null,
  devModeOn: null,
  mmrEnabled: null,
  singleRealmMode: null,
  twoPlayerMode: null,
  seasonPassAddress: null,
  villagePassAddress: null,
  worldAddress: null,
  prizeDistributionAddress: null,
  entryTokenAddress: null,
  feeTokenAddress: null,
  feeAmount: null,
  registrationCount: null,
  registrationCountMax: null,
  registrationStartAt: null,
  registrationEndAt: null,
  settledPlayersCount: null,
  settledRealmsCount: null,
  settledVillagesCount: null,
  winnerJackpotAmount: null,
};

const buildWorldSummaryQuery = (worldName: string): string => {
  const registryName = encodePaddedFeltAscii(worldName);
  return `
    SELECT
      gr.game_id AS game_id,
      wc.blitz_mode_on AS blitz_mode_on,
      gr.start_settling_at AS start_settling_at,
      gr.start_main_at AS start_main_at,
      gr.end_at AS end_at,
      gr.dev_mode_on AS dev_mode_on,
      cc."mmr_config.enabled" AS mmr_enabled,
      wc."blitz_registration_config.registration_count" AS registration_count,
      wc."blitz_registration_config.registration_count_max" AS registration_count_max,
      cc.entry_token_address AS entry_token_address,
      cc.fee_token AS fee_token,
      wc."blitz_registration_config.fee_amount" AS fee_amount,
      wc."blitz_registration_config.registration_start_at" AS registration_start_at,
      gr.start_main_at AS registration_end_at,
      wc."blitz_settlement_config.single_realm_mode" AS single_realm_mode,
      wc."blitz_settlement_config.two_player_mode" AS two_player_mode,
      (SELECT COUNT(DISTINCT owner) FROM "s2-Structure" s WHERE s.game_id = gr.game_id AND s.category IN (1, 5) AND s.owner != '${ZERO_OWNER_ADDRESS}') AS settled_players_count,
      (SELECT COUNT(*) FROM "s2-Structure" s WHERE s.game_id = gr.game_id AND s.category = 1 AND s.owner != '${ZERO_OWNER_ADDRESS}') AS settled_realms_count,
      (SELECT COUNT(*) FROM "s2-Structure" s WHERE s.game_id = gr.game_id AND s.category = 5 AND s.owner != '${ZERO_OWNER_ADDRESS}') AS settled_villages_count
    FROM "s2-GameRegistry" gr
    JOIN "s2-WorldConfig" wc ON wc.game_id = gr.game_id
    CROSS JOIN "s2-ChainConfig" cc
    WHERE gr.name = "${registryName}"
    LIMIT 1
  `;
};

function parseMaybeHexToNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  try {
    const parsed = value.startsWith("0x") || value.startsWith("0X") ? Number(BigInt(value)) : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseMaybeHexToBigInt(value: unknown): bigint | null {
  if (value == null) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.floor(value));
  if (typeof value !== "string") return null;

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function parseMaybeHexToAddress(value: unknown): string | null {
  const parsed = parseMaybeHexToBigInt(value);
  return parsed && parsed !== 0n ? `0x${parsed.toString(16)}` : null;
}

function parseMaybeBoolean(value: unknown): boolean | null {
  const parsed = parseMaybeHexToNumber(value);
  return parsed == null ? null : parsed !== 0;
}

function resolveMode(blitzModeOn: unknown): WorldSummaryMode | null {
  const parsed = parseMaybeHexToNumber(blitzModeOn);
  if (parsed == null) return null;
  return parsed === 0 ? "eternum" : "blitz";
}

function parseSummaryRow(row: Record<string, unknown>): SummaryFields {
  const mode = resolveMode(row.blitz_mode_on);
  return {
    gameId: parseMaybeHexToNumber(row.game_id),
    worldId: mode ?? undefined,
    mode,
    startSettlingAt: parseMaybeHexToNumber(row.start_settling_at),
    startMainAt: parseMaybeHexToNumber(row.start_main_at),
    endAt: parseMaybeHexToNumber(row.end_at),
    devModeOn: parseMaybeBoolean(row.dev_mode_on),
    mmrEnabled: parseMaybeBoolean(row.mmr_enabled),
    singleRealmMode: parseMaybeBoolean(row.single_realm_mode),
    twoPlayerMode: parseMaybeBoolean(row.two_player_mode),
    seasonPassAddress: null,
    villagePassAddress: null,
    worldAddress: null,
    prizeDistributionAddress: null,
    entryTokenAddress: parseMaybeHexToAddress(row.entry_token_address),
    feeTokenAddress: parseMaybeHexToAddress(row.fee_token),
    feeAmount: parseMaybeHexToBigInt(row.fee_amount)?.toString() ?? null,
    registrationCount: parseMaybeHexToNumber(row.registration_count),
    registrationCountMax: parseMaybeHexToNumber(row.registration_count_max),
    registrationStartAt: parseMaybeHexToNumber(row.registration_start_at),
    registrationEndAt: mode === "blitz" ? parseMaybeHexToNumber(row.registration_end_at) : null,
    settledPlayersCount: parseMaybeHexToNumber(row.settled_players_count),
    settledRealmsCount: parseMaybeHexToNumber(row.settled_realms_count),
    settledVillagesCount: parseMaybeHexToNumber(row.settled_villages_count),
    winnerJackpotAmount: null,
  };
}

export interface WorldSummaryFetchResult {
  fields: SummaryFields;
  ok: boolean;
}

export async function fetchWorldSummaryResult(worldName: string, timeoutMs: number): Promise<WorldSummaryFetchResult> {
  try {
    const query = buildWorldSummaryQuery(worldName);
    const url = `${resolveToriiSqlUrl()}?query=${encodeURIComponent(query)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { fields: { ...NULL_SUMMARY }, ok: false };

    const rows = (await response.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows) || rows.length === 0) return { fields: { ...NULL_SUMMARY }, ok: false };

    return { fields: parseSummaryRow(rows[0]!), ok: true };
  } catch {
    return { fields: { ...NULL_SUMMARY }, ok: false };
  }
}

export async function fetchWorldSummary(worldName: string, timeoutMs: number): Promise<SummaryFields> {
  return (await fetchWorldSummaryResult(worldName, timeoutMs)).fields;
}
