import type { IdentityAuth } from "./auth";
import { openFrontierGameIds, readEnrolledAccounts, runningFrontierGameIds } from "./day-open";
import { directoryShard, directoryShardOf, fetchShardGames, gamesUrl } from "./directory";
import type { IdentityEnv } from "./env";
import { json } from "./http";
import { playerAccounts } from "./campaign-entry";

/** The game a shop request names: the chain of its shard and its id. */
export interface NamedGame {
  chainId: string;
  gameId: number;
}

const gameKey = (chainId: string) => `0x${BigInt(chainId).toString(16)}`;

/** The game a request names, or null when it names none or a malformed one. */
export const namedGame = (chain: unknown, game: unknown): NamedGame | null => {
  const gameId = typeof game === "string" || typeof game === "number" ? Number(game) : 0;
  if (typeof chain !== "string" || !Number.isSafeInteger(gameId) || gameId <= 0) return null;
  try {
    return { chainId: gameKey(chain), gameId };
  } catch {
    return null;
  }
};

/**
 * The one rule of the shop: the account plays in a running Frontier game. True when the game runs and the account is one
 * of its players; throws while its shard cannot say.
 */
export type ShopAccess = (realmsId: string, game: NamedGame) => Promise<boolean>;

export type EnteredGames = (realmsId: string) => Promise<NamedGame[]>;

export const enteredGamesOf = (
  env: Pick<IdentityEnv, "DB" | "GUARDIAN">,
  fetchShard: typeof fetch,
  now: () => number,
): EnteredGames => {
  const accountOf = playerAccounts(env);
  return async (realmsId) => {
    const account = await accountOf(realmsId);
    const entered: NamedGame[] = [];
    for (const { shardUrl, ...game } of await openFrontierGames(env, fetchShard, now()))
      if (await isEnrolled(shardUrl, game.gameId, account)) entered.push(game);
    return entered;
  };
};

export async function openFrontierGames(
  env: Pick<IdentityEnv, "DB">,
  fetchShard: typeof fetch,
  now: number,
): Promise<(NamedGame & { shardUrl: string })[]> {
  const shard = await directoryShard(env.DB);
  if (!shard) return [];
  return openFrontierGameIds(await fetchShardGames(shard, gamesUrl(shard, null), fetchShard), now).map((gameId) => ({
    chainId: gameKey(shard.chainId),
    gameId,
    shardUrl: shard.url,
  }));
}

/** The shop's rule, read from the game's shard: its directory says the game runs, its enrollment says who plays. */
export const shopAccessOf = (
  env: Pick<IdentityEnv, "DB" | "GUARDIAN">,
  fetchShard: typeof fetch,
  now: () => number,
): ShopAccess => {
  const accountOf = playerAccounts(env);
  return async (realmsId, { chainId, gameId }) => {
    const shard = await directoryShardOf(env.DB, chainId);
    if (!shard) return false;
    const running = runningFrontierGameIds(await fetchShardGames(shard, gamesUrl(shard, null), fetchShard), now());
    if (!running.includes(gameId)) return false;
    return isEnrolled(shard.url, gameId, await accountOf(realmsId));
  };
};

const isEnrolled = async (shardUrl: string, gameId: number, account: string) =>
  (await readEnrolledAccounts(shardUrl, gameId)).some((owner) => BigInt(owner) === BigInt(account));

/**
 * Every shop read goes through here: the signed-in account and its seat in the game the request names, or the response
 * that refuses it. No session is 401, no valid game 400, a shard that cannot say 503, and a game that does not run or
 * does not have this account as a player 404: there is no shop outside a running Frontier game one plays in.
 */
export async function authorizeShop(
  request: Request,
  auth: IdentityAuth,
  access: ShopAccess,
  named: NamedGame | null,
): Promise<{ owner: string } | Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  const owner = session?.user.realmsId;
  if (!owner) return json({ error: "unauthorized" }, 401);
  if (!named) return json({ error: "invalid_game" }, 400);
  let plays: boolean;
  try {
    plays = await access(owner, named);
  } catch (error) {
    console.error("[shop] the game's shard could not say who plays", error);
    return json({ error: "shop_unavailable" }, 503);
  }
  return plays ? { owner } : json({ error: "no_shop_outside_a_frontier_game" }, 404);
}
