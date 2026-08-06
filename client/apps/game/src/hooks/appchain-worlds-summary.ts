import type { WorldSummary } from "@bibliothecadao/types";

import { env } from "../../env";

/**
 * Worlds summary for the appchain, read straight from torii.
 *
 * On mainnet each game has its own torii, so the browser cannot fan out to N
 * endpoints and the realtime-server aggregates them. The appchain runs ONE
 * torii indexing every world plus the factory, so the whole list is a single
 * query and no server is needed.
 *
 * Every row is scoped by world: torii keys model rows as
 * `internal_id = "<world_address>:<entity_id>"` (there is no world_address
 * column on model tables). The realtime-server's equivalent query assumes one
 * world per torii (`WorldConfig LIMIT 1`, unscoped structure counts), which
 * would silently mix worlds together here.
 */

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";

const WORLDS_QUERY = `
  SELECT
    w.address AS world_address,
    w.name AS world_name,
    c.blitz_mode_on AS blitz_mode_on,
    c."season_config.start_settling_at" AS start_settling_at,
    c."season_config.start_main_at" AS start_main_at,
    c."season_config.end_at" AS end_at,
    c."season_config.dev_mode_on" AS dev_mode_on,
    c."blitz_registration_config.registration_count" AS registration_count,
    c."blitz_registration_config.registration_count_max" AS registration_count_max,
    c."blitz_registration_config.registration_start_at" AS registration_start_at,
    c."blitz_registration_config.entry_token_address" AS entry_token_address,
    c."blitz_registration_config.fee_token" AS fee_token,
    c."blitz_registration_config.fee_amount" AS fee_amount,
    c."blitz_settlement_config.single_realm_mode" AS single_realm_mode,
    c."blitz_settlement_config.two_player_mode" AS two_player_mode,
    (SELECT COUNT(DISTINCT owner) FROM "s1_eternum-Structure" s
       WHERE s.internal_id LIKE w.address || ':%' AND s.category IN (1, 5) AND s.owner != '${ZERO_ADDRESS}')
      AS settled_players_count,
    (SELECT COUNT(*) FROM "s1_eternum-Structure" s
       WHERE s.internal_id LIKE w.address || ':%' AND s.category = 1 AND s.owner != '${ZERO_ADDRESS}')
      AS settled_realms_count,
    (SELECT COUNT(*) FROM "s1_eternum-Structure" s
       WHERE s.internal_id LIKE w.address || ':%' AND s.category = 5 AND s.owner != '${ZERO_ADDRESS}')
      AS settled_villages_count
  FROM "wf-WorldDeployed" w
  LEFT JOIN "s1_eternum-WorldConfig" c ON c.internal_id LIKE w.address || ':%'
`;

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value);
  const parsed = text.startsWith("0x") ? Number(BigInt(text)) : Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const toBoolean = (value: unknown): boolean | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const asNumber = toNumber(value);
  return asNumber === null ? null : asNumber !== 0;
};

const toAddress = (value: unknown): string | null => {
  if (!value) return null;
  const text = String(value);
  if (!text.startsWith("0x")) return text;
  const normalized = `0x${BigInt(text).toString(16)}`;
  return normalized === "0x0" ? null : normalized;
};

/** Torii stores felt short strings zero-padded; decode back to the game name. */
const decodeName = (value: unknown): string => {
  const text = String(value ?? "").replace(/^0x/, "").replace(/^0+/, "");
  if (!text) return "";
  const hex = text.length % 2 === 0 ? text : `0${text}`;
  let out = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code) out += String.fromCharCode(code);
  }
  return out;
};

export async function fetchAppchainWorldsSummary(toriiBaseUrl: string): Promise<WorldSummary[]> {
  const base = toriiBaseUrl.replace(/\/+$/, "");
  const response = await fetch(`${base}/sql?query=${encodeURIComponent(WORLDS_QUERY)}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Appchain worlds query failed: ${response.status} ${response.statusText}`);
  }

  const rows = (await response.json()) as Record<string, unknown>[];
  if (!Array.isArray(rows)) {
    throw new Error("Appchain worlds query returned non-array payload");
  }

  const now = Date.now();
  return rows
    .map((row): WorldSummary => {
      const blitz = toBoolean(row.blitz_mode_on);
      return {
        name: decodeName(row.world_name),
        chain: "appchain",
        // The world is indexed by our torii, so it is by definition reachable.
        alive: true,
        lastCheckedAt: now,
        mode: blitz === null ? null : blitz ? "blitz" : "eternum",
        startSettlingAt: toNumber(row.start_settling_at),
        startMainAt: toNumber(row.start_main_at),
        endAt: toNumber(row.end_at),
        devModeOn: toBoolean(row.dev_mode_on),
        // MMR and prize distribution are not wired on the appchain yet.
        mmrEnabled: false,
        singleRealmMode: toBoolean(row.single_realm_mode),
        twoPlayerMode: toBoolean(row.two_player_mode),
        seasonPassAddress: null,
        villagePassAddress: null,
        worldAddress: toAddress(row.world_address),
        prizeDistributionAddress: null,
        entryTokenAddress: toAddress(row.entry_token_address),
        feeTokenAddress: toAddress(row.fee_token),
        feeAmount: row.fee_amount ? String(row.fee_amount) : null,
        registrationCount: toNumber(row.registration_count),
        registrationCountMax: toNumber(row.registration_count_max),
        registrationStartAt: toNumber(row.registration_start_at),
        // Registration closes when the main phase opens — same as the
        // realtime-server's mapping.
        registrationEndAt: toNumber(row.start_main_at),
        settledPlayersCount: toNumber(row.settled_players_count),
        settledRealmsCount: toNumber(row.settled_realms_count),
        settledVillagesCount: toNumber(row.settled_villages_count),
        winnerJackpotAmount: null,
      };
    })
    // A world exists in the factory before its config is deployed; those rows
    // are not joinable games yet.
    .filter((world) => world.name !== "" && world.mode !== null);
}

export const isAppchainWorldsSummaryEnabled = (): boolean =>
  env.VITE_PUBLIC_CHAIN === "appchain" && Boolean(env.VITE_PUBLIC_TORII);
