import type { WorldSummary } from "@bibliothecadao/types";

import { appchainModel } from "@/dojo/game-scope";
import type { WorldDeployment } from "@/runtime/world/world-directory";

/**
 * Games summary for one appchain world, read straight from its torii.
 *
 * A world's `GameRegistry` holds one row per game (blitz) or season
 * (eternum); joining its per-game `WorldConfig` row and the chain-global
 * `ChainConfig` yields everything a landing card needs in a single query.
 * The landing merges these lists across the world directory — the summary
 * row's `(worldId, gameId)` pair is the identity every downstream flow keys
 * on.
 */

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Newest games matter most on the landing; bound the shared world's history.
const GAMES_LIMIT = 200;

const buildGamesQuery = () => {
  const structure = appchainModel("Structure");
  return `
  SELECT
    g.game_id AS game_id,
    g.name AS game_name,
    g.dev_mode_on AS dev_mode_on,
    g.start_settling_at AS start_settling_at,
    g.start_main_at AS start_main_at,
    g.end_at AS end_at,
    c.blitz_mode_on AS blitz_mode_on,
    c."blitz_registration_config.registration_count" AS registration_count,
    c."blitz_registration_config.registration_count_max" AS registration_count_max,
    c."blitz_registration_config.registration_start_at" AS registration_start_at,
    c."blitz_registration_config.fee_amount" AS fee_amount,
    c."blitz_settlement_config.single_realm_mode" AS single_realm_mode,
    c."blitz_settlement_config.two_player_mode" AS two_player_mode,
    cc.entry_token_address AS entry_token_address,
    cc.fee_token AS fee_token,
    (SELECT COUNT(DISTINCT owner) FROM "${structure}" s
       WHERE s.game_id = g.game_id AND s.category IN (1, 5) AND s.owner != '${ZERO_ADDRESS}')
      AS settled_players_count,
    (SELECT COUNT(*) FROM "${structure}" s
       WHERE s.game_id = g.game_id AND s.category = 1 AND s.owner != '${ZERO_ADDRESS}')
      AS settled_realms_count,
    (SELECT COUNT(*) FROM "${structure}" s
       WHERE s.game_id = g.game_id AND s.category = 5 AND s.owner != '${ZERO_ADDRESS}')
      AS settled_villages_count
  FROM "${appchainModel("GameRegistry")}" g
  JOIN "${appchainModel("WorldConfig")}" c ON c.game_id = g.game_id
  CROSS JOIN "${appchainModel("ChainConfig")}" cc
  ORDER BY g.game_id DESC
  LIMIT ${GAMES_LIMIT}
`;
};

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
  const text = String(value ?? "")
    .replace(/^0x/, "")
    .replace(/^0+/, "");
  if (!text) return "";
  const hex = text.length % 2 === 0 ? text : `0${text}`;
  let out = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code) out += String.fromCharCode(code);
  }
  return out;
};

export async function fetchAppchainWorldsSummary(world: WorldDeployment): Promise<WorldSummary[]> {
  const response = await fetch(`${world.toriiBaseUrl}/sql?query=${encodeURIComponent(buildGamesQuery())}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Games summary query failed for world "${world.id}": ${response.status} ${response.statusText}`);
  }

  const rows = (await response.json()) as Record<string, unknown>[];
  if (!Array.isArray(rows)) {
    throw new Error(`Games summary query returned non-array payload for world "${world.id}"`);
  }

  const now = Date.now();
  return (
    rows
      .map((row): WorldSummary => {
        const blitz = toBoolean(row.blitz_mode_on);
        return {
          name: decodeName(row.game_name),
          chain: world.chain,
          worldId: world.id,
          gameId: toNumber(row.game_id),
          // The game is indexed by this world's torii, so it is by definition reachable.
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
          worldAddress: world.worldAddress,
          prizeDistributionAddress: null,
          entryTokenAddress: toAddress(row.entry_token_address),
          feeTokenAddress: toAddress(row.fee_token),
          feeAmount: row.fee_amount ? String(row.fee_amount) : null,
          registrationCount: toNumber(row.registration_count),
          registrationCountMax: toNumber(row.registration_count_max),
          registrationStartAt: toNumber(row.registration_start_at),
          // Registration closes when the main phase opens.
          registrationEndAt: toNumber(row.start_main_at),
          settledPlayersCount: toNumber(row.settled_players_count),
          settledRealmsCount: toNumber(row.settled_realms_count),
          settledVillagesCount: toNumber(row.settled_villages_count),
          winnerJackpotAmount: null,
        };
      })
      // A registry row exists before its config transaction lands; those are
      // not joinable games yet.
      .filter((game) => game.name !== "" && game.mode !== null && (game.gameId ?? 0) > 0)
  );
}
