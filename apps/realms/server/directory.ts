import type { HeraldGameDirectory, HeraldGameDirectoryEntry, ShardManifest } from "@bibliothecadao/eternum/game-sync";

import type { IdentityEnv } from "./env";
import { json } from "./http";

const SHARD_STATUSES = ["active", "draining", "retired"] as const;
type ShardStatus = (typeof SHARD_STATUSES)[number];

interface ListedShard {
  url: string;
  chainId: string;
  status: ShardStatus;
}

type ShardListing =
  | (ListedShard & { games: HeraldGameDirectoryEntry[] })
  | (ListedShard & { games: null; error: "unavailable" });

/** How long one shard's games directory is served from the cache before it is read again. */
const GAMES_CACHE_SECONDS = 15;
const SHARD_TIMEOUT_MS = 5_000;

interface DirectoryDependencies {
  db: D1Database;
  cache: Cache;
  fetchShard: typeof fetch;
  readLaunchDirectory: () => Promise<LaunchDirectory>;
}

interface LaunchDirectory {
  chains: { chainId: string; gameIds: number[] }[];
}

/**
 * GET /api/directory — every live or upcoming game on every listed shard, each carrying its shard's URL and chain id so
 * the app opens it on its own shard; a settled game leaves this list for the history. A shard that cannot be read is
 * listed by name with an error; it never empties the list. With ?player=<gameplay account>, each shard answers that
 * player's standing in its games; the shared listing is cached, a player's standing never is.
 */
export const handleDirectory = async (request: Request, dependencies: DirectoryDependencies) => {
  const player = playerOf(request);
  if (player === INVALID) return json({ error: "invalid_player" }, 400);
  const launchDirectory = await readLaunchDirectoryRecords(dependencies);
  if (!launchDirectory) return json({ error: "launch_directory_unavailable" }, 503);
  const listings = await listShards(dependencies, player);
  return json({
    shards: listings.map((listing) =>
      listing.games === null
        ? listing
        : {
            ...listing,
            games: listing.games.filter(
              (game) => isPlayerGame(game, listing.chainId, launchDirectory) && !isSettled(game),
            ),
          },
    ),
  });
};

/**
 * GET /api/directory/history?limit=&cursor=[&player=] — settled games across every listed shard, newest end first, a
 * page at a time. With ?player=, only the games that player entered. A shard that cannot be read is named in `failures`.
 */
export const handleDirectoryHistory = async (request: Request, dependencies: DirectoryDependencies) => {
  const url = new URL(request.url);
  const player = playerOf(request);
  const limit = Number(url.searchParams.get("limit") ?? HISTORY_PAGE);
  const cursor = url.searchParams.get("cursor");
  if (player === INVALID) return json({ error: "invalid_player" }, 400);
  if (!Number.isInteger(limit) || limit < 1 || limit > HISTORY_PAGE_MAX) return json({ error: "invalid_limit" }, 400);
  if (cursor !== null && !HISTORY_CURSOR.test(cursor)) return json({ error: "invalid_cursor" }, 400);
  const launchDirectory = await readLaunchDirectoryRecords(dependencies);
  if (!launchDirectory) return json({ error: "launch_directory_unavailable" }, 503);
  const listings = await listShards(dependencies, player);
  const settled = listings
    .flatMap((listing) =>
      (listing.games ?? [])
        .filter(
          (game) =>
            isPlayerGame(game, listing.chainId, launchDirectory) &&
            isSettled(game) &&
            (player === null || game.player_state?.registered === true),
        )
        .map((game) => ({ ...game, chainId: listing.chainId, shardUrl: listing.url })),
    )
    .sort((a, b) => historyPosition(b).localeCompare(historyPosition(a)));
  const after = cursor === null ? settled : settled.filter((game) => historyPosition(game) < positionOfCursor(cursor));
  const games = after.slice(0, limit);
  return json({
    games,
    next: after.length > limit ? cursorOf(games.at(-1)!) : null,
    failures: listings.filter((listing) => listing.games === null).map(({ url }) => ({ url, error: "unavailable" })),
  });
};

const HISTORY_PAGE = 20;
const HISTORY_PAGE_MAX = 100;
const HISTORY_CURSOR = /^\d+:0x[0-9a-f]+:\d+$/;
const INVALID = Symbol("invalid player");

const playerOf = (request: Request): string | null | typeof INVALID => {
  const player = new URL(request.url).searchParams.get("player");
  if (player === null) return null;
  return /^0x[0-9a-fA-F]{1,64}$/.test(player) ? player : INVALID;
};

/** Every listed shard's games, each shard read on its own so one that fails is named and the rest still answer. */
const listShards = async (dependencies: DirectoryDependencies, player: string | null) => {
  const { results } = await dependencies.db
    .prepare(`SELECT "url", "chainId", "status" FROM "shards" WHERE "status" != 'retired' ORDER BY "addedAt"`)
    .all<ListedShard>();
  return Promise.all(
    results.map((shard) =>
      listShard(shard, () =>
        player
          ? fetchShardGames(shard, `${shard.url}/games?player=${player}`, dependencies.fetchShard)
          : readCachedShardGames(shard, dependencies.cache, dependencies.fetchShard),
      ),
    ),
  );
};

const isSettled = (game: HeraldGameDirectoryEntry) => game.status === "Settled";

/** Only a completed launch-service run makes a game a player season. Chain id prevents numeric game-id collisions. */
const isPlayerGame = (game: HeraldGameDirectoryEntry, shardChainId: string, directory: LaunchDirectory) =>
  directory.chains.some(
    ({ chainId, gameIds }) => BigInt(chainId) === BigInt(shardChainId) && gameIds.includes(game.game_id),
  );

const readLaunchDirectoryRecords = async ({ readLaunchDirectory }: DirectoryDependencies) => {
  try {
    const directory = await readLaunchDirectory();
    if (
      !Array.isArray(directory.chains) ||
      directory.chains.some(
        ({ chainId, gameIds }) =>
          typeof chainId !== "string" ||
          !isFelt(chainId) ||
          !Array.isArray(gameIds) ||
          gameIds.some((gameId) => !Number.isSafeInteger(gameId) || gameId < 0),
      )
    ) {
      throw new Error("Launch directory has an invalid shape");
    }
    return directory;
  } catch (error) {
    console.error("directory_launch_records_unavailable", error);
    return null;
  }
};

const isFelt = (value: string) => {
  try {
    return BigInt(value) >= 0n;
  } catch {
    return false;
  }
};

/** Newest end first, then chain and game, as one sortable string; a cursor names the last game of a page. */
const historyPosition = ({
  clock,
  chainId,
  game_id,
}: {
  clock: { end_at: number };
  chainId: string;
  game_id: number;
}) =>
  [
    String(clock.end_at).padStart(12, "0"),
    BigInt(chainId).toString(16).padStart(64, "0"),
    String(game_id).padStart(10, "0"),
  ].join(":");
const cursorOf = (game: { clock: { end_at: number }; chainId: string; game_id: number }) =>
  `${game.clock.end_at}:0x${BigInt(game.chainId).toString(16)}:${game.game_id}`;
const positionOfCursor = (cursor: string) => {
  const [endAt, chainId, gameId] = cursor.split(":");
  return historyPosition({ clock: { end_at: Number(endAt) }, chainId: chainId!, game_id: Number(gameId) });
};

const listShard = async (
  shard: ListedShard,
  readGames: () => Promise<HeraldGameDirectoryEntry[]>,
): Promise<ShardListing> => {
  try {
    return { ...shard, games: await readGames() };
  } catch (error) {
    console.error("directory_shard_unavailable", shard.url, error);
    return { ...shard, games: null, error: "unavailable" };
  }
};

const readCachedShardGames = async (shard: ListedShard, cache: Cache, fetchShard: typeof fetch) => {
  // Keyed by chain as well as URL: a URL relisted under a new chain never answers from the old chain's listing.
  const key = new Request(`${shard.url}/games?chain=${shard.chainId}`);
  const cached = await cache.match(key);
  if (cached) return ((await cached.json()) as HeraldGameDirectory).games;
  const games = await fetchShardGames(shard, `${shard.url}/games`, fetchShard);
  await cache.put(key, Response.json({ games }, { headers: { "cache-control": `max-age=${GAMES_CACHE_SECONDS}` } }));
  return games;
};

const fetchShardGames = async (shard: ListedShard, url: string, fetchShard: typeof fetch) => {
  const response = await fetchShard(url, { signal: AbortSignal.timeout(SHARD_TIMEOUT_MS), redirect: "manual" });
  if (!response.ok) throw new Error(`games directory answered ${response.status}`);
  const directory = (await response.json()) as HeraldGameDirectory;
  // A Herald folding another chain would list that chain's games under this shard's name.
  if (!Array.isArray(directory.games) || BigInt(directory.chain) !== BigInt(shard.chainId)) {
    throw new Error(`games directory is not chain ${shard.chainId}`);
  }
  return directory.games;
};

/** The account class and guardian key that, with a Realms id, place a player's account on every shard we list. */
interface AccountIdentity {
  accountClassHash: string;
  guardianPublicKey: string;
}

/**
 * POST /api/directory/shards {url} — lists a shard by its Herald URL under the chain id its manifest declares. A chain id
 * already listed under another URL is refused; the unique index is the race-proof guarantee. A retired shard's URL is
 * listed again under its new chain. A shard whose accounts sit under another class or guardian is refused: the app
 * places a player on every listed shard at one address, the one our guardian approves devices for.
 */
export const handleAdmitShard = async (
  request: Request,
  db: D1Database,
  fetchShard: typeof fetch,
  identity: AccountIdentity,
) => {
  const url = shardUrlOf(await readJsonField(request, "url"));
  if (!url) return json({ error: "invalid_shard_url" }, 400);
  const manifest = await readManifest(url, fetchShard);
  if (!manifest) return json({ error: "manifest_unavailable" }, 502);
  if (!hasAccountIdentity(manifest, identity)) return json({ error: "account_identity_differs" }, 409);
  const { chainId } = manifest;
  const listed = await db
    .prepare('SELECT "url" FROM "shards" WHERE "chainId" = ?')
    .bind(chainId)
    .first<{ url: string }>();
  if (listed)
    return listed.url === url ? json({ url, chainId }) : json({ error: "chain_id_listed", url: listed.url }, 409);
  // A retired shard's host can serve a new chain: its URL is listed again, under the chain its manifest now names.
  const relisted = await db
    .prepare(
      `UPDATE "shards" SET "chainId" = ?, "status" = 'active', "addedAt" = ? WHERE "url" = ? AND "status" = 'retired' RETURNING "url"`,
    )
    .bind(chainId, Date.now(), url)
    .first();
  if (relisted) return json({ url, chainId }, 201);
  try {
    await db
      .prepare(`INSERT INTO "shards" ("url", "chainId", "status", "addedAt") VALUES (?, ?, 'active', ?)`)
      .bind(url, chainId, Date.now())
      .run();
  } catch {
    return json({ error: "shard_listed" }, 409);
  }
  return json({ url, chainId }, 201);
};

/** POST /api/directory/shards/status {url, status} — drains or retires a listed shard. */
export const handleShardStatus = async (request: Request, db: D1Database) => {
  const body = (await request.json().catch(() => null)) as { url?: unknown; status?: unknown } | null;
  const url = shardUrlOf(body?.url);
  const status = SHARD_STATUSES.find((candidate) => candidate === body?.status);
  if (!url || !status) return json({ error: "invalid_shard_status" }, 400);
  const updated = await db
    .prepare('UPDATE "shards" SET "status" = ? WHERE "url" = ? RETURNING "url"')
    .bind(status, url)
    .first();
  return updated ? json({ url, status }) : json({ error: "shard_not_listed" }, 404);
};

/** One spelling per shard: an https origin with no path, so the same Herald is never listed twice. */
const shardUrlOf = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.pathname === "/" && !url.search && !url.hash ? url.origin : null;
  } catch {
    return null;
  }
};

const readJsonField = async (request: Request, field: string): Promise<unknown> => {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  return body?.[field];
};

const FELT = /^0x[0-9a-fA-F]{1,64}$/;

/** The manifest, its chain id normalized; null when it cannot be read or names no chain. */
const readManifest = async (url: string, fetchShard: typeof fetch) => {
  try {
    const response = await fetchShard(`${url}/manifest`, {
      signal: AbortSignal.timeout(SHARD_TIMEOUT_MS),
      redirect: "manual",
    });
    if (!response.ok) return null;
    const manifest = (await response.json()) as Partial<ShardManifest>;
    return typeof manifest.chainId === "string" && FELT.test(manifest.chainId)
      ? { ...manifest, chainId: `0x${BigInt(manifest.chainId).toString(16)}` }
      : null;
  } catch {
    return null;
  }
};

const hasAccountIdentity = (manifest: Partial<AccountIdentity>, identity: AccountIdentity) =>
  sameFelt(manifest.accountClassHash, identity.accountClassHash) &&
  sameFelt(manifest.guardianPublicKey, identity.guardianPublicKey);

const sameFelt = (value: unknown, expected: string) =>
  typeof value === "string" && FELT.test(value) && BigInt(value) === BigInt(expected);

/** The directory's cron: every listed shard has a running notifier, and a retired one has none. */
export const superviseNotifiers = async (db: D1Database, notifiers: IdentityEnv["SHARD_NOTIFIER"]): Promise<void> => {
  const { results } = await db.prepare('SELECT "url", "chainId", "status" FROM "shards"').all<ListedShard>();
  await Promise.all(
    results.map((shard) => {
      const notifier = notifiers.get(notifiers.idFromName(shard.url));
      return shard.status === "retired" ? notifier.stop() : notifier.watch({ url: shard.url, chainId: shard.chainId });
    }),
  );
};
