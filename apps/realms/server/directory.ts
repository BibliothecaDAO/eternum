import { normalizeStarknetAddress, isSameStarknetAddress } from "@realms-world/identity";
import { Effect } from "effect";
import type { HeraldGameDirectory, HeraldGameDirectoryEntry, ShardManifest } from "@bibliothecadao/eternum/game-sync";

import type { IdentityEnv } from "./env";
import { json } from "./http";

interface DirectoryShard {
  url: string;
  chainId: string;
}

/** A shard's games, and the manifest the app opens the shard from, so a game's entry never waits on its Herald. */
interface ShardRead {
  games: HeraldGameDirectoryEntry[];
  manifest: ShardManifest;
  confirmedBlock: number;
}

type ShardListing =
  | (DirectoryShard & ShardRead)
  | (DirectoryShard & { games: null; manifest: null; error: "unavailable" });

/** How long the shared listing is served from a colo's cache before it is read again. */
const LISTING_CACHE_SECONDS = 15;
const SHARD_TIMEOUT_MS = 5_000;

interface DirectoryDependencies {
  db: D1Database;
  cache: Cache;
  fetchShard: typeof fetch;
  readLaunchDirectory: () => Promise<LaunchDirectory>;
}

interface LaunchDirectory {
  chains: { chainId: string; games: { gameId: number; slotId: number | null }[] }[];
}

interface DirectoryListing {
  launchDirectory: LaunchDirectory | null;
  listing: ShardListing | null;
}

export const handleDirectory = async (request: Request, dependencies: DirectoryDependencies) => {
  const player = playerOf(request);
  if (player === INVALID) return json({ error: "invalid_player" }, 400);
  const { launchDirectory, listing } = await readListing(request, dependencies, player);
  if (listing === null) return json({ shard: null });
  return json({
    shard: isUnavailable(listing, launchDirectory)
      ? { ...listing, games: null, manifest: null, error: "unavailable" }
      : { ...listing, games: playerGames(listing, launchDirectory).filter((game) => !isSettled(game)) },
  });
};

export const handleDirectoryHistory = async (request: Request, dependencies: DirectoryDependencies) => {
  const url = new URL(request.url);
  const player = playerOf(request);
  const mode = url.searchParams.get("mode");
  const limit = Number(url.searchParams.get("limit") ?? HISTORY_PAGE);
  const cursor = url.searchParams.get("cursor");
  if (player === INVALID) return json({ error: "invalid_player" }, 400);
  if (mode !== null && !HISTORY_MODES.has(mode)) return json({ error: "invalid_mode" }, 400);
  if (!Number.isInteger(limit) || limit < 1 || limit > HISTORY_PAGE_MAX) return json({ error: "invalid_limit" }, 400);
  if (cursor !== null && !HISTORY_CURSOR.test(cursor)) return json({ error: "invalid_cursor" }, 400);
  const { launchDirectory, listing } = await readListing(request, dependencies, player);
  const settled = listing === null ? [] : settledGames(listing, launchDirectory, player, mode);
  const after = cursor === null ? settled : settled.filter((game) => historyPosition(game) < positionOfCursor(cursor));
  const games = after.slice(0, limit);
  return json({
    games,
    next: after.length > limit ? cursorOf(games.at(-1)!) : null,
    failures:
      listing !== null && isUnavailable(listing, launchDirectory) ? [{ url: listing.url, error: "unavailable" }] : [],
  });
};

const settledGames = (
  listing: ShardListing,
  launchDirectory: LaunchDirectory | null,
  player: string | null,
  mode: string | null,
) =>
  playerGames(listing, launchDirectory)
    .filter(
      (game) =>
        isSettled(game) &&
        (player === null || game.player_state?.registered === true) &&
        (mode === null || game.mode === mode),
    )
    .map((game) => ({ ...game, chainId: listing.chainId, shardUrl: listing.url }))
    .sort((a, b) => historyPosition(b).localeCompare(historyPosition(a)));

const HISTORY_PAGE = 20;
const HISTORY_PAGE_MAX = 100;
const HISTORY_CURSOR = /^\d+:0x[0-9a-f]+:\d+$/;
const HISTORY_MODES = new Set<string>(
  Object.keys({ blitz: true, eternum: true, frontier: true } satisfies Record<HeraldGameDirectoryEntry["mode"], true>),
);
const INVALID = Symbol("invalid player");

const playerOf = (request: Request): string | null | typeof INVALID => {
  const player = new URL(request.url).searchParams.get("player");
  if (player === null) return null;
  return /^0x[0-9a-fA-F]{1,64}$/.test(player) ? player : INVALID;
};

/**
 * A player's listing is read for that request. Everyone else shares one listing per colo, cached whole, so a hit touches
 * neither database nor any Herald; only a complete listing is cached, so a failed read is retried by the next request.
 */
const readListing = async (
  request: Request,
  dependencies: DirectoryDependencies,
  player: string | null,
): Promise<DirectoryListing> => {
  if (player) return readFreshListing(dependencies, player);
  const key = new Request(new URL("/api/directory/shared-shard", request.url));
  const cached = await dependencies.cache.match(key);
  if (cached) return (await cached.json()) as DirectoryListing;
  const listing = await readFreshListing(dependencies, null);
  if (isComplete(listing)) {
    const headers = { "cache-control": `max-age=${LISTING_CACHE_SECONDS}` };
    await dependencies.cache.put(key, Response.json(listing, { headers }));
  }
  return listing;
};

/** The launch records and the shard registry live in two databases in two regions: they are read together. */
const readFreshListing = async (dependencies: DirectoryDependencies, player: string | null) => {
  const [launchDirectory, listing] = await Promise.all([
    readLaunchDirectoryRecords(dependencies),
    readListedShard(dependencies, player),
  ]);
  return { launchDirectory, listing };
};

const isComplete = ({ launchDirectory, listing }: DirectoryListing) =>
  launchDirectory !== null && listing?.games !== null;

const isUnavailable = (listing: ShardListing, launchDirectory: LaunchDirectory | null) =>
  listing.games === null || launchDirectory === null;

const readListedShard = async (dependencies: DirectoryDependencies, player: string | null) => {
  const shard = await directoryShard(dependencies.db);
  return shard && listShard(shard, () => readShard(shard, gamesUrl(shard, player), dependencies.fetchShard));
};

export const directoryShard = (db: D1Database) =>
  db.prepare('SELECT "url", "chainId" FROM "shards"').first<DirectoryShard>();

export const directoryShardOf = async (db: D1Database, chainId: string) => {
  const shard = await directoryShard(db);
  return shard && BigInt(shard.chainId) === BigInt(chainId) ? shard : null;
};

/** A shard's game directory, as everyone sees it or with one player's standing in each game. */
export const gamesUrl = (shard: DirectoryShard, player: string | null) =>
  `${shard.url}/games${player ? `?player=${player}` : ""}`;

const isSettled = (game: HeraldGameDirectoryEntry) => game.status === "Settled";

/** Only completed launches make a game visible; paid games carry their slot number. */
const playerGames = (listing: ShardListing, directory: LaunchDirectory | null) => {
  if (directory === null) return [];
  const records = directory.chains.find((row) => BigInt(row.chainId) === BigInt(listing.chainId))?.games ?? [];
  return (listing.games ?? []).flatMap((game) => {
    const declared = records.find((row) => row.gameId === game.game_id);
    return declared ? [{ ...game, slotId: declared.slotId }] : [];
  });
};

const readLaunchDirectoryRecords = async ({ readLaunchDirectory }: DirectoryDependencies) => {
  try {
    const directory = await readLaunchDirectory();
    if (
      !Array.isArray(directory.chains) ||
      directory.chains.some(
        ({ chainId, games }) =>
          typeof chainId !== "string" ||
          !isFelt(chainId) ||
          !Array.isArray(games) ||
          games.some(
            ({ gameId, slotId }) =>
              !Number.isSafeInteger(gameId) ||
              gameId <= 0 ||
              (slotId !== null && (!Number.isSafeInteger(slotId) || slotId <= 0)),
          ),
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

const listShard = async (shard: DirectoryShard, read: () => Promise<ShardRead>): Promise<ShardListing> => {
  try {
    return { ...shard, ...(await read()) };
  } catch (error) {
    console.error("directory_shard_unavailable", shard.url, error);
    return { ...shard, games: null, manifest: null, error: "unavailable" };
  }
};

/** A shard whose manifest cannot be read is unavailable, like one whose games cannot be: no client could open it. */
const readShard = async (shard: DirectoryShard, gamesUrl: string, fetchShard: typeof fetch): Promise<ShardRead> => {
  const [directory, manifest] = await Promise.all([
    fetchShardDirectory(shard, gamesUrl, fetchShard),
    readManifest(shard.url, fetchShard),
  ]);
  // A Herald serving another chain's manifest would open this shard's games on that chain.
  if (!manifest || BigInt(manifest.chainId) !== BigInt(shard.chainId)) {
    throw new Error(`manifest is not chain ${shard.chainId}`);
  }
  return { games: directory.games, confirmedBlock: directory.confirmed_block, manifest: manifest as ShardManifest };
};

/** A shard's games, read within the shard timeout and refused unless its Herald folds the shard's own chain. */
export const fetchShardGames = async (shard: DirectoryShard, url: string, fetchShard: typeof fetch) =>
  (await fetchShardDirectory(shard, url, fetchShard)).games;

const fetchShardDirectory = async (shard: DirectoryShard, url: string, fetchShard: typeof fetch) => {
  const response = await fetchShard(url, { signal: AbortSignal.timeout(SHARD_TIMEOUT_MS), redirect: "manual" });
  if (!response.ok) throw new Error(`games directory answered ${response.status}`);
  const directory = (await response.json()) as HeraldGameDirectory;
  // A Herald folding another chain would list that chain's games under this shard's name.
  if (!Array.isArray(directory.games) || BigInt(directory.chain) !== BigInt(shard.chainId)) {
    throw new Error(`games directory is not chain ${shard.chainId}`);
  }
  return directory;
};

/** The account class and guardian key that, with a Realms id, place a player's account on every shard we list. */
interface AccountIdentity {
  accountClassHash: string;
  guardianPublicKey: string;
}

export const handleRegisterShard = (
  request: Request,
  db: D1Database,
  fetchShard: typeof fetch,
  identity: AccountIdentity,
  notifiers: IdentityEnv["SHARD_NOTIFIER"],
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const url = shardUrlOf(yield* Effect.promise(() => readJsonField(request, "url")));
      if (!url) return json({ error: "invalid_shard_url" }, 400);
      const manifest = yield* Effect.promise(() => readManifest(url, fetchShard));
      if (!manifest) return json({ error: "manifest_unavailable" }, 502);
      if (!hasAccountIdentity(manifest, identity)) return json({ error: "account_identity_differs" }, 409);
      const shard = { url, chainId: manifest.chainId };
      yield* Effect.promise(() => replaceShard(db, notifiers, shard));
      return json({ shard });
    }),
  );

export const handleRemoveShard = async (db: D1Database, notifiers: IdentityEnv["SHARD_NOTIFIER"]) => {
  const listed = await directoryShard(db);
  if (listed) await notifierOf(notifiers, listed).stop();
  await db.prepare('DELETE FROM "shards"').run();
  return json({ shard: null });
};

const replaceShard = async (db: D1Database, notifiers: IdentityEnv["SHARD_NOTIFIER"], shard: DirectoryShard) => {
  const listed = await directoryShard(db);
  if (listed && listed.url !== shard.url) await notifierOf(notifiers, listed).stop();
  await db
    .prepare(
      'INSERT INTO "shards" ("slot", "chainId", "url") VALUES (1, ?, ?) ON CONFLICT ("slot") DO UPDATE SET "chainId" = excluded."chainId", "url" = excluded."url"',
    )
    .bind(shard.chainId, shard.url)
    .run();
  await notifierOf(notifiers, shard).watch(shard);
};

const notifierOf = (notifiers: IdentityEnv["SHARD_NOTIFIER"], shard: DirectoryShard) =>
  notifiers.get(notifiers.idFromName(shard.url));

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
      ? { ...manifest, chainId: normalizeStarknetAddress(manifest.chainId) }
      : null;
  } catch {
    return null;
  }
};

const hasAccountIdentity = (manifest: Partial<AccountIdentity>, identity: AccountIdentity) =>
  (["accountClassHash", "guardianPublicKey"] as const).every((key) => {
    const value = manifest[key];
    return typeof value === "string" && FELT.test(value) && isSameStarknetAddress(value, identity[key]);
  });

export const superviseNotifiers = async (db: D1Database, notifiers: IdentityEnv["SHARD_NOTIFIER"]): Promise<void> => {
  const shard = await directoryShard(db);
  if (shard) await notifierOf(notifiers, shard).watch(shard);
};
