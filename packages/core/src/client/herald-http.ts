import type {
  HeraldGameDirectory,
  HeraldGameLeaderboard,
  HeraldGameSnapshot,
  HeraldHistoryPage,
  HeraldTransactionCount,
} from "../sync/herald-http-types";

import type { Shard } from "./shard";

const buildHeraldUrl = (shard: Pick<Shard, "url">, pathname: string): string => {
  const url = new URL(shard.url);
  const prefix = url.pathname.replace(/\/+$/, "");
  url.pathname = `${prefix}${pathname}`;
  url.search = "";
  url.hash = "";
  return url.toString();
};

const fetchHeraldJson = async <Payload>(url: string, description: string): Promise<Payload> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`${description} failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as Payload;
};

export const fetchHeraldGameDirectory = async (
  shard: Pick<Shard, "url">,
  playerAddress?: string,
): Promise<HeraldGameDirectory> => {
  const url = new URL(buildHeraldUrl(shard, "/games"));
  if (playerAddress) url.searchParams.set("player", playerAddress);
  return fetchHeraldJson(url.toString(), `Herald directory for ${shard.url}`);
};

/**
 * One game's current facts for these models; with an actor, only what that player's scope holds. With an owner, every
 * model that carries an owner narrows to that account's rows and those of its structures, such as its armies.
 */
export const fetchHeraldGameSnapshot = async (
  shard: Pick<Shard, "url">,
  gameId: number,
  models: readonly string[],
  actor?: string,
  owner?: string,
): Promise<HeraldGameSnapshot> => {
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw new Error(`Herald snapshot requires a positive game id; received ${gameId}`);
  }
  if (models.length === 0) throw new Error("Herald snapshot requires at least one model");

  const url = new URL(buildHeraldUrl(shard, `/games/${gameId}/snapshot`));
  url.searchParams.set("models", [...new Set(models)].join(","));
  if (actor) url.searchParams.set("actor", actor);
  if (owner) url.searchParams.set("owner", owner);
  return fetchHeraldJson(url.toString(), `Herald snapshot for ${shard.url} game ${gameId}`);
};

export const fetchHeraldGameReviewSnapshot = async (shard: Shard, gameId: number): Promise<HeraldGameSnapshot> => {
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw new Error(`Herald review snapshot requires a positive game id; received ${gameId}`);
  }
  return fetchHeraldJson(
    buildHeraldUrl(shard, `/games/${gameId}/review/snapshot`),
    `Herald review snapshot for ${shard.url} game ${gameId}`,
  );
};

export const fetchHeraldGameHistory = async (
  shard: Shard,
  gameId: number,
  input: {
    entityId?: bigint | number | string;
    limit?: number;
    model?: string;
    story?: string;
    offset?: number;
    owner?: string;
  } = {},
): Promise<HeraldHistoryPage> => {
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw new Error(`Herald history requires a positive game id; received ${gameId}`);
  }
  const url = new URL(buildHeraldUrl(shard, `/games/${gameId}/history`));
  if (input.entityId !== undefined) url.searchParams.set("entity_id", String(input.entityId));
  if (input.limit !== undefined) url.searchParams.set("limit", String(input.limit));
  if (input.model) url.searchParams.set("model", input.model);
  if (input.story) url.searchParams.set("story", input.story);
  if (input.offset !== undefined) url.searchParams.set("offset", String(input.offset));
  if (input.owner) url.searchParams.set("owner", input.owner);
  return fetchHeraldJson(url.toString(), `Herald history for ${shard.url} game ${gameId}`);
};

export const fetchHeraldTransactionCount = async (shard: Shard, gameId: number): Promise<HeraldTransactionCount> => {
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw new Error(`Herald transaction count requires a positive game id; received ${gameId}`);
  }
  return fetchHeraldJson(
    buildHeraldUrl(shard, `/games/${gameId}/transactions/count`),
    `Herald transaction count for ${shard.url} game ${gameId}`,
  );
};

export const snapshotModelRows = (snapshot: HeraldGameSnapshot, model: string): Array<Record<string, unknown>> => {
  const selected = snapshot.models.find((entry) => entry.model === model);
  if (!selected) throw new Error(`Herald snapshot omitted requested model ${model}`);
  return selected.rows.map((row) => row.value);
};

export const feltEquals = (left: unknown, right: unknown): boolean => {
  try {
    return BigInt(left as string | number | bigint) === BigInt(right as string | number | bigint);
  } catch {
    return false;
  }
};

/** A game's leaderboard in its mode's shape: Frontier's season board, or the points board of every other mode. */
export const fetchHeraldLeaderboard = async (shard: Shard, gameId: number): Promise<HeraldGameLeaderboard> => {
  if (!Number.isSafeInteger(gameId) || gameId <= 0)
    throw new Error(`Herald leaderboard requires a positive game id; received ${gameId}`);
  return fetchHeraldJson(
    buildHeraldUrl(shard, `/games/${gameId}/leaderboard`),
    `Herald leaderboard for ${shard.url} game ${gameId}`,
  );
};

const directoryStreams = new Map<string, { source: EventSource; listeners: Set<() => void> }>();

/** One invalidation stream per shard, shared by every mounted directory consumer. */
export function subscribeHeraldDirectory(shard: Shard, onChange: () => void): () => void {
  const url = buildHeraldUrl(shard, "/games/updates");
  let stream = directoryStreams.get(url);
  if (!stream) {
    const listeners = new Set<() => void>();
    const source = new EventSource(url);
    source.onmessage = () => {
      for (const listener of listeners) listener();
    };
    stream = { source, listeners };
    directoryStreams.set(url, stream);
  }
  stream.listeners.add(onChange);
  const subscribed = stream;
  return () => {
    if (!subscribed.listeners.delete(onChange)) return;
    if (!subscribed.listeners.size) {
      subscribed.source.close();
      directoryStreams.delete(url);
    }
  };
}
