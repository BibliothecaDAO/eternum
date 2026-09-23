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
}

/**
 * GET /api/directory — every game on every listed shard, each carrying its shard's URL and chain id so the app opens it
 * on its own shard. A shard that cannot be read is listed by name with an error; it never empties the list.
 */
export const handleDirectory = async ({ db, cache, fetchShard }: DirectoryDependencies): Promise<Response> => {
  const { results } = await db
    .prepare(`SELECT "url", "chainId", "status" FROM "shards" WHERE "status" != 'retired' ORDER BY "addedAt"`)
    .all<ListedShard>();
  const shards = await Promise.all(results.map((shard) => listShard(shard, cache, fetchShard)));
  return json({ shards });
};

const listShard = async (shard: ListedShard, cache: Cache, fetchShard: typeof fetch): Promise<ShardListing> => {
  try {
    return { ...shard, games: await readShardGames(shard, cache, fetchShard) };
  } catch (error) {
    console.error("directory_shard_unavailable", shard.url, error);
    return { ...shard, games: null, error: "unavailable" };
  }
};

const readShardGames = async (shard: ListedShard, cache: Cache, fetchShard: typeof fetch) => {
  const key = new Request(`${shard.url}/games`);
  const cached = await cache.match(key);
  if (cached) return ((await cached.json()) as HeraldGameDirectory).games;
  const response = await fetchShard(key.url, { signal: AbortSignal.timeout(SHARD_TIMEOUT_MS), redirect: "manual" });
  if (!response.ok) throw new Error(`games directory answered ${response.status}`);
  const directory = (await response.json()) as HeraldGameDirectory;
  // A Herald folding another chain would list that chain's games under this shard's name.
  if (!Array.isArray(directory.games) || BigInt(directory.chain) !== BigInt(shard.chainId)) {
    throw new Error(`games directory is not chain ${shard.chainId}`);
  }
  await cache.put(key, Response.json(directory, { headers: { "cache-control": `max-age=${GAMES_CACHE_SECONDS}` } }));
  return directory.games;
};

/**
 * POST /api/directory/shards {url} — lists a shard by its Herald URL under the chain id its manifest declares. A chain id
 * already listed under another URL is refused; the unique index is the race-proof guarantee.
 */
export const handleAdmitShard = async (request: Request, db: D1Database, fetchShard: typeof fetch) => {
  const url = shardUrlOf(await readJsonField(request, "url"));
  if (!url) return json({ error: "invalid_shard_url" }, 400);
  const chainId = await readManifestChainId(url, fetchShard);
  if (!chainId) return json({ error: "manifest_unavailable" }, 502);
  const listed = await db
    .prepare('SELECT "url" FROM "shards" WHERE "chainId" = ?')
    .bind(chainId)
    .first<{ url: string }>();
  if (listed)
    return listed.url === url ? json({ url, chainId }) : json({ error: "chain_id_listed", url: listed.url }, 409);
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

const readManifestChainId = async (url: string, fetchShard: typeof fetch): Promise<string | null> => {
  try {
    const response = await fetchShard(`${url}/manifest`, {
      signal: AbortSignal.timeout(SHARD_TIMEOUT_MS),
      redirect: "manual",
    });
    if (!response.ok) return null;
    const manifest = (await response.json()) as Partial<ShardManifest>;
    return typeof manifest.chainId === "string" && /^0x[0-9a-fA-F]{1,64}$/.test(manifest.chainId)
      ? `0x${BigInt(manifest.chainId).toString(16)}`
      : null;
  } catch {
    return null;
  }
};

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
