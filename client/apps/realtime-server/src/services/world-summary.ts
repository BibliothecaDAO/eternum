import { type WorldSummary, type WorldSummaryMode } from "@bibliothecadao/types";

const CARTRIDGE_API_BASE = "https://api.cartridge.gg";
const ZERO_OWNER_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";

const WORLD_SUMMARY_QUERY = `
  SELECT
    "blitz_mode_on" AS blitz_mode_on,
    "season_config.start_settling_at" AS start_settling_at,
    "season_config.start_main_at" AS start_main_at,
    "season_config.end_at" AS end_at,
    "season_config.dev_mode_on" AS dev_mode_on,
    "mmr_config.enabled" AS mmr_enabled,
    "blitz_registration_config.registration_count" AS registration_count,
    "blitz_registration_config.registration_count_max" AS registration_count_max,
    "blitz_registration_config.entry_token_address" AS entry_token_address,
    "blitz_registration_config.fee_token" AS fee_token,
    "blitz_registration_config.fee_amount" AS fee_amount,
    "blitz_registration_config.registration_start_at" AS registration_start_at,
    "season_config.start_main_at" AS registration_end_at,
    "blitz_settlement_config.single_realm_mode" AS single_realm_mode,
    "blitz_settlement_config.two_player_mode" AS two_player_mode,
    "season_addresses_config.season_pass_address" AS season_pass_address,
    "village_pass_config.token_address" AS village_pass_token_address,
    (SELECT COUNT(DISTINCT owner) FROM "s1_eternum-Structure" WHERE category IN (1, 5) AND owner != '${ZERO_OWNER_ADDRESS}') AS settled_players_count,
    (SELECT COUNT(*) FROM "s1_eternum-Structure" WHERE category = 1 AND owner != '${ZERO_OWNER_ADDRESS}') AS settled_realms_count,
    (SELECT COUNT(*) FROM "s1_eternum-Structure" WHERE category = 5 AND owner != '${ZERO_OWNER_ADDRESS}') AS settled_villages_count
  FROM "s1_eternum-WorldConfig"
  LIMIT 1
`;

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

function parseMaybeHexToNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    try {
      if (v.startsWith("0x") || v.startsWith("0X")) return Number(BigInt(v));
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  return null;
}

function parseMaybeHexToBigInt(v: unknown): bigint | null {
  if (v == null) return null;
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.floor(v));
  if (typeof v === "string") {
    try {
      if (v.startsWith("0x") || v.startsWith("0X")) return BigInt(v);
      return BigInt(v);
    } catch {
      return null;
    }
  }
  return null;
}

function parseMaybeHexToAddress(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed || trimmed === "0x0" || trimmed === "0x" || trimmed === "0") return null;
    try {
      const big = BigInt(trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`);
      if (big === 0n) return null;
      return `0x${big.toString(16)}`;
    } catch {
      return null;
    }
  }
  if (typeof v === "number" || typeof v === "bigint") {
    const big = BigInt(v);
    if (big === 0n) return null;
    return `0x${big.toString(16)}`;
  }
  return null;
}

function parseMaybeBoolean(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  const n = parseMaybeHexToNumber(v);
  if (n == null) return null;
  return n !== 0;
}

function resolveMode(blitzModeOn: unknown): WorldSummaryMode | null {
  const n = parseMaybeHexToNumber(blitzModeOn);
  if (n == null) return null;
  return n === 0 ? "eternum" : "blitz";
}

function parseSummaryRow(row: Record<string, unknown>): SummaryFields {
  const mode = resolveMode(row.blitz_mode_on);
  const registrationEndAt =
    mode === "blitz"
      ? (parseMaybeHexToNumber(row.registration_end_at) ?? parseMaybeHexToNumber(row.start_main_at))
      : null;

  return {
    mode,
    startSettlingAt: parseMaybeHexToNumber(row.start_settling_at),
    startMainAt: parseMaybeHexToNumber(row.start_main_at),
    endAt: parseMaybeHexToNumber(row.end_at),
    devModeOn: parseMaybeBoolean(row.dev_mode_on),
    mmrEnabled: parseMaybeBoolean(row.mmr_enabled),
    singleRealmMode: parseMaybeBoolean(row.single_realm_mode),
    twoPlayerMode: parseMaybeBoolean(row.two_player_mode),
    seasonPassAddress: parseMaybeHexToAddress(row.season_pass_address),
    villagePassAddress: parseMaybeHexToAddress(row.village_pass_token_address),
    worldAddress: null,
    prizeDistributionAddress: null,
    entryTokenAddress: parseMaybeHexToAddress(row.entry_token_address),
    feeTokenAddress: parseMaybeHexToAddress(row.fee_token),
    feeAmount: parseMaybeHexToBigInt(row.fee_amount)?.toString() ?? null,
    registrationCount: parseMaybeHexToNumber(row.registration_count),
    registrationCountMax: parseMaybeHexToNumber(row.registration_count_max),
    registrationStartAt: parseMaybeHexToNumber(row.registration_start_at),
    registrationEndAt,
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
    const url = `${CARTRIDGE_API_BASE}/x/${worldName}/torii/sql?query=${encodeURIComponent(WORLD_SUMMARY_QUERY)}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { fields: { ...NULL_SUMMARY }, ok: false };

    const rows = (await response.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows) || rows.length === 0) return { fields: { ...NULL_SUMMARY }, ok: false };

    return { fields: parseSummaryRow(rows[0]!), ok: true };
  } catch {
    return { fields: { ...NULL_SUMMARY }, ok: false };
  }
}

export async function fetchWorldSummary(worldName: string, timeoutMs: number): Promise<SummaryFields> {
  const result = await fetchWorldSummaryResult(worldName, timeoutMs);
  return result.fields;
}
