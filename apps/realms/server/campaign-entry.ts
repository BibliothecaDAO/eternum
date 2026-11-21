import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type {
  HeraldFrontierLeaderboard,
  HeraldGameDirectoryEntry,
  HeraldGameSnapshot,
} from "@bibliothecadao/eternum/game-sync";
import { realmsAccountAddress } from "@realms-world/identity/account";

import { directoryShard, directoryShardOf, fetchShardGames, gamesUrl, type DirectoryShard } from "./directory";
import { ACCOUNT_CLASS_HASH, type IdentityEnv } from "./env";

/** What a player's home in a running campaign game was founded with: nothing yet, a held Realm, or a campaign ticket. */
export type HomeSource = "none" | "realm" | "campaign";

/** The entry entitlement kind the relay registers for a campaign ticket (apps/value-relay/src/realm-entry.ts). */
const CAMPAIGN_PASS_KIND = 3;

type IdentityShards = Pick<IdentityEnv, "DB" | "GUARDIAN">;

/** The account a Realms id plays with on every shard we list. */
const playerAccount = async (env: Pick<IdentityEnv, "GUARDIAN">, realmsId: string) =>
  realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, await env.GUARDIAN.publicKey());

/** playerAccount for many Realms ids, asking the guardian for its key once. */
export const playerAccounts = (env: Pick<IdentityEnv, "GUARDIAN">) => {
  let guardianKey: Promise<string> | undefined;
  return async (realmsId: string) =>
    realmsAccountAddress(realmsId, ACCOUNT_CLASS_HASH, await (guardianKey ??= env.GUARDIAN.publicKey()));
};

/** A ticket can supply a free home's first source. Unknown shard state leaves the ticket unspent. */
export async function hasCampaignHomeSource(
  env: IdentityShards,
  fetchShard: typeof fetch,
  realmsId: string,
): Promise<boolean | null> {
  const source = await homeSourceOf(env, fetchShard, realmsId);
  return source === null ? null : source !== "none";
}

/**
 * The source of the account's home across the running campaign games of every listed shard: a campaign home before a
 * Realm, a Realm before none. Null while any shard cannot say.
 */
export async function homeSourceOf(
  env: IdentityShards,
  fetchShard: typeof fetch,
  realmsId: string,
): Promise<HomeSource | null> {
  const account = await playerAccount(env, realmsId);
  const sources = await eachCampaignGame(env, fetchShard, account, (shard, game) =>
    sourceIn(shard.url, game.game_id, account, fetchShard),
  );
  if (sources === null) return null;
  if (sources.includes("campaign")) return "campaign";
  return sources.includes("realm") ? "realm" : "none";
}

/** Where a founded player stands on a running campaign game's season board. */
export interface CampaignStanding {
  chainId: string;
  gameId: number;
  sitesCleared: number;
}

/**
 * Every founded player on the running campaign games' season boards, by accountKey. Null while any shard or board cannot
 * say: Herald answers 503 while its history store is unhealthy.
 */
export async function campaignStandings(
  env: IdentityShards,
  fetchShard: typeof fetch,
): Promise<Map<string, CampaignStanding> | null> {
  const boards = await eachCampaignGame(env, fetchShard, null, async (shard, game) =>
    (await seasonBoard(shard.url, game.game_id, fetchShard)).entries.map((entry): [string, CampaignStanding] => [
      accountKey(entry.address),
      {
        chainId: shard.chainId,
        gameId: game.game_id,
        sitesCleared: entry.sites_cleared.total,
      },
    ]),
  );
  return boards === null ? null : new Map(boards.flat());
}

/**
 * The sites each account on one Frontier game's season board has cleared, by account; null when the game's shard is
 * not listed or its board cannot answer now.
 */
export async function sitesClearedOn(
  env: Pick<IdentityEnv, "DB">,
  fetchShard: typeof fetch,
  game: { chainId: string; gameId: number },
): Promise<Map<string, number> | null> {
  const shard = await directoryShardOf(env.DB, game.chainId);
  if (!shard) return null;
  try {
    const board = await seasonBoard(shard.url, game.gameId, fetchShard);
    return new Map(board.entries.map((entry) => [accountKey(entry.address), entry.sites_cleared.total]));
  } catch {
    return null;
  }
}

/** One spelling per account address, whatever its padding or case. */
export const accountKey = (address: string) => `0x${BigInt(address).toString(16)}`;

/** One answer per running campaign game on every listed shard; null when any shard or game cannot answer. */
async function eachCampaignGame<T>(
  env: IdentityShards,
  fetchShard: typeof fetch,
  player: string | null,
  read: (shard: DirectoryShard, game: HeraldGameDirectoryEntry) => Promise<T>,
): Promise<T[] | null> {
  const shard = await directoryShard(env.DB);
  if (!shard) return [];
  try {
    const games = await fetchShardGames(shard, gamesUrl(shard, player), fetchShard);
    const running = games.filter(isCampaignGame);
    return await Promise.all(running.map((game) => read(shard, game)));
  } catch {
    return null;
  }
}

export const isCampaignGame = (_game: HeraldGameDirectoryEntry): boolean => false;

async function seasonBoard(shardUrl: string, gameId: number, fetchShard: typeof fetch) {
  const url = new URL(`/games/${gameId}/leaderboard`, shardUrl);
  const response = await fetchShard(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("campaign_board_unavailable");
  const board = (await response.json()) as HeraldFrontierLeaderboard;
  if (board.mode !== "frontier" || BigInt(board.game_id) !== BigInt(gameId) || !Array.isArray(board.entries))
    throw new Error("campaign_board_invalid");
  return board;
}

async function sourceIn(shardUrl: string, gameId: number, account: string, fetchShard: typeof fetch) {
  const store = await homeFacts(shardUrl, gameId, fetchShard);
  const entitlement = store.get("EntryEntitlement", { game_id: gameId, owner: BigInt(account) });
  if (entitlement) return Number(entitlement.pass_kind) === CAMPAIGN_PASS_KIND ? "campaign" : "realm";
  const homes = new Set(
    [...store.inGame("Structure", gameId)].filter((row) => row.owner === BigInt(account)).map((row) => row.entity_id),
  );
  return [...store.inGame("SettledRealm", gameId)].some((row) => homes.has(row.home)) ? "realm" : "none";
}

/** The confirmed facts that name a home's source, read from the game's snapshot. */
async function homeFacts(shardUrl: string, gameId: number, fetchShard: typeof fetch) {
  const models = ["EntryEntitlement", "Structure", "SettledRealm"];
  const url = new URL(`/games/${gameId}/snapshot`, shardUrl);
  url.searchParams.set("models", models.join(","));
  const response = await fetchShard(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("campaign_snapshot_unavailable");
  const snapshot = (await response.json()) as HeraldGameSnapshot;
  if (
    BigInt(snapshot.game_id) !== BigInt(gameId) ||
    !Number.isSafeInteger(snapshot.confirmed_block) ||
    snapshot.confirmed_block < 0
  )
    throw new Error("campaign_snapshot_invalid");
  if (!models.every((name) => snapshot.models.filter((model) => model.model === name).length === 1))
    throw new Error("campaign_snapshot_incomplete");
  const store = new NativeFactStore();
  store.applyFacts(
    snapshot.models.flatMap(({ model, rows }) =>
      rows.map((row) => {
        if (BigInt(row.value.game_id as string) !== BigInt(gameId)) throw new Error("campaign_snapshot_game_differs");
        return { model, key: row.key, value: row.value };
      }),
    ),
  );
  return store;
}
