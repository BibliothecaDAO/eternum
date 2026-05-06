import { Hono, type Context } from "hono";

import type { AppEnv } from "../middleware/auth";
import { createCachedJsonResponse, createJsonPayload, type CachedJsonPayload } from "./cache-response";
import {
  ALL_TILES_QUERY,
  buildActiveTransfersQuery,
  buildLeaderboardQuery,
  buildStoryEventsQuery,
  HYPERSTRUCTURE_LEADERBOARD_CONFIG_QUERY,
  HYPERSTRUCTURES_QUERY,
  HYPERSTRUCTURE_SHAREHOLDERS_QUERY,
  HYPERSTRUCTURES_WITH_MULTIPLIER_QUERY,
  STRUCTURE_AND_EXPLORER_DETAILS_QUERY,
} from "../../services/torii-queries";

type CacheStatus = "hit" | "stale" | "miss";

type CacheEntry<T> = {
  value: T;
  fetchedAt: number;
};

type CacheResult<T> = {
  value: T;
  status: CacheStatus;
  fetchedAt: number;
};

type LeaderboardCachePayload = {
  registeredRows: unknown[];
  hyperstructureShareholderRows: unknown[];
  hyperstructureRows: unknown[];
  hyperstructureConfigRow?: unknown;
};

type ActiveTransferCacheRow = {
  id?: string | null;
  event_id?: string | null;
  tx_hash?: string | null;
  timestamp?: string | number | bigint | null;
  resource_transfer_from_entity_id?: string | number | bigint | null;
  resource_transfer_to_entity_id?: string | number | bigint | null;
  resource_transfer_resources?: unknown;
  resource_transfer_is_mint?: boolean | string | number | null;
  resource_transfer_travel_time?: string | number | bigint | null;
};

type ActiveTransferCachePayload = {
  id: string;
  eventId?: string;
  txHash?: string;
  sourceEntityId: number;
  destinationEntityId: number;
  resourceIds: number[];
  startedAtMs: number;
  endsAtMs: number;
  progress: number;
};

const DEFAULT_LEADERBOARD_TTL_MS = 60_000;
const DEFAULT_LEADERBOARD_STALE_MS = 5 * 60_000;
const DEFAULT_LEADERBOARD_MAX_ENTRIES = 5;
const DEFAULT_LEADERBOARD_LIMIT = 50;
const DEFAULT_LEADERBOARD_LIMIT_MAX = 5_000;

const DEFAULT_STORY_EVENTS_TTL_MS = 10_000;
const DEFAULT_STORY_EVENTS_STALE_MS = 2 * 60_000;
const DEFAULT_STORY_EVENTS_MAX_ENTRIES = 25;
const DEFAULT_STORY_EVENTS_LIMIT = 50;
const DEFAULT_STORY_EVENTS_LIMIT_MAX = 2_000;

const DEFAULT_ACTIVE_TRANSFERS_TTL_MS = 5_000;
const DEFAULT_ACTIVE_TRANSFERS_STALE_MS = 30_000;
const DEFAULT_ACTIVE_TRANSFERS_MAX_ENTRIES = 25;
const DEFAULT_ACTIVE_TRANSFERS_LIMIT = 500;
const DEFAULT_ACTIVE_TRANSFERS_LIMIT_MAX = 5_000;
const DEFAULT_ACTIVE_TRANSFERS_LOOKBACK_SECONDS = 1_800;
const DEFAULT_ACTIVE_TRANSFERS_LOOKBACK_SECONDS_MAX = 86_400;

const DEFAULT_TILES_TTL_MS = 5_000;
const DEFAULT_TILES_STALE_MS = 30_000;
const DEFAULT_TILES_MAX_ENTRIES = 2;

const DEFAULT_HYPERSTRUCTURES_TTL_MS = 5_000;
const DEFAULT_HYPERSTRUCTURES_STALE_MS = 30_000;
const DEFAULT_HYPERSTRUCTURES_MAX_ENTRIES = 10;

const DEFAULT_STRUCTURE_EXPLORER_DETAILS_TTL_MS = 5_000;
const DEFAULT_STRUCTURE_EXPLORER_DETAILS_STALE_MS = 30_000;
const DEFAULT_STRUCTURE_EXPLORER_DETAILS_MAX_ENTRIES = 5;

const cacheEnabled = process.env.CACHE_ENABLED !== "false";

const parseEnvNumber = (value: string | undefined, fallback: number, min = 0): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
};

const parseEnvInt = (value: string | undefined, fallback: number, min = 0): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
};

const clampNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const leaderboardTtlMs = parseEnvNumber(process.env.LEADERBOARD_CACHE_TTL_MS, DEFAULT_LEADERBOARD_TTL_MS);
const leaderboardStaleMs = parseEnvNumber(
  process.env.LEADERBOARD_CACHE_STALE_MS,
  DEFAULT_LEADERBOARD_STALE_MS,
  leaderboardTtlMs,
);
const leaderboardMaxEntries = parseEnvInt(
  process.env.LEADERBOARD_CACHE_MAX_ENTRIES,
  DEFAULT_LEADERBOARD_MAX_ENTRIES,
  1,
);
const leaderboardLimitDefault = parseEnvInt(process.env.LEADERBOARD_CACHE_LIMIT_DEFAULT, DEFAULT_LEADERBOARD_LIMIT, 1);
const leaderboardLimitMax = parseEnvInt(process.env.LEADERBOARD_CACHE_LIMIT_MAX, DEFAULT_LEADERBOARD_LIMIT_MAX, 1);

const storyEventsTtlMs = parseEnvNumber(process.env.STORY_EVENTS_CACHE_TTL_MS, DEFAULT_STORY_EVENTS_TTL_MS);
const storyEventsStaleMs = parseEnvNumber(
  process.env.STORY_EVENTS_CACHE_STALE_MS,
  DEFAULT_STORY_EVENTS_STALE_MS,
  storyEventsTtlMs,
);
const storyEventsMaxEntries = parseEnvInt(
  process.env.STORY_EVENTS_CACHE_MAX_ENTRIES,
  DEFAULT_STORY_EVENTS_MAX_ENTRIES,
  1,
);
const storyEventsLimitDefault = parseEnvInt(
  process.env.STORY_EVENTS_CACHE_LIMIT_DEFAULT,
  DEFAULT_STORY_EVENTS_LIMIT,
  1,
);
const storyEventsLimitMax = parseEnvInt(process.env.STORY_EVENTS_CACHE_LIMIT_MAX, DEFAULT_STORY_EVENTS_LIMIT_MAX, 1);

const activeTransfersTtlMs = parseEnvNumber(process.env.ACTIVE_TRANSFERS_CACHE_TTL_MS, DEFAULT_ACTIVE_TRANSFERS_TTL_MS);
const activeTransfersStaleMs = parseEnvNumber(
  process.env.ACTIVE_TRANSFERS_CACHE_STALE_MS,
  DEFAULT_ACTIVE_TRANSFERS_STALE_MS,
  activeTransfersTtlMs,
);
const activeTransfersMaxEntries = parseEnvInt(
  process.env.ACTIVE_TRANSFERS_CACHE_MAX_ENTRIES,
  DEFAULT_ACTIVE_TRANSFERS_MAX_ENTRIES,
  1,
);
const activeTransfersLimitDefault = parseEnvInt(
  process.env.ACTIVE_TRANSFERS_CACHE_LIMIT_DEFAULT,
  DEFAULT_ACTIVE_TRANSFERS_LIMIT,
  1,
);
const activeTransfersLimitMax = parseEnvInt(
  process.env.ACTIVE_TRANSFERS_CACHE_LIMIT_MAX,
  DEFAULT_ACTIVE_TRANSFERS_LIMIT_MAX,
  1,
);
const activeTransfersLookbackSecondsDefault = parseEnvInt(
  process.env.ACTIVE_TRANSFERS_CACHE_LOOKBACK_SECONDS_DEFAULT,
  DEFAULT_ACTIVE_TRANSFERS_LOOKBACK_SECONDS,
  1,
);
const activeTransfersLookbackSecondsMax = parseEnvInt(
  process.env.ACTIVE_TRANSFERS_CACHE_LOOKBACK_SECONDS_MAX,
  DEFAULT_ACTIVE_TRANSFERS_LOOKBACK_SECONDS_MAX,
  1,
);

const tilesTtlMs = parseEnvNumber(process.env.TILES_CACHE_TTL_MS, DEFAULT_TILES_TTL_MS);
const tilesStaleMs = parseEnvNumber(process.env.TILES_CACHE_STALE_MS, DEFAULT_TILES_STALE_MS, tilesTtlMs);
const tilesMaxEntries = parseEnvInt(process.env.TILES_CACHE_MAX_ENTRIES, DEFAULT_TILES_MAX_ENTRIES, 1);

const hyperstructuresTtlMs = parseEnvNumber(process.env.HYPERSTRUCTURES_CACHE_TTL_MS, DEFAULT_HYPERSTRUCTURES_TTL_MS);
const hyperstructuresStaleMs = parseEnvNumber(
  process.env.HYPERSTRUCTURES_CACHE_STALE_MS,
  DEFAULT_HYPERSTRUCTURES_STALE_MS,
  hyperstructuresTtlMs,
);
const hyperstructuresMaxEntries = parseEnvInt(
  process.env.HYPERSTRUCTURES_CACHE_MAX_ENTRIES,
  DEFAULT_HYPERSTRUCTURES_MAX_ENTRIES,
  1,
);

const structureExplorerDetailsTtlMs = parseEnvNumber(
  process.env.STRUCTURE_EXPLORER_DETAILS_CACHE_TTL_MS,
  DEFAULT_STRUCTURE_EXPLORER_DETAILS_TTL_MS,
);
const structureExplorerDetailsStaleMs = parseEnvNumber(
  process.env.STRUCTURE_EXPLORER_DETAILS_CACHE_STALE_MS,
  DEFAULT_STRUCTURE_EXPLORER_DETAILS_STALE_MS,
  structureExplorerDetailsTtlMs,
);
const structureExplorerDetailsMaxEntries = parseEnvInt(
  process.env.STRUCTURE_EXPLORER_DETAILS_CACHE_MAX_ENTRIES,
  DEFAULT_STRUCTURE_EXPLORER_DETAILS_MAX_ENTRIES,
  1,
);

const leaderboardCache = new Map<string, CacheEntry<CachedJsonPayload>>();
const leaderboardInFlight = new Map<string, Promise<CachedJsonPayload>>();
const storyEventsCache = new Map<string, CacheEntry<CachedJsonPayload>>();
const storyEventsInFlight = new Map<string, Promise<CachedJsonPayload>>();
const activeTransfersCache = new Map<string, CacheEntry<CachedJsonPayload>>();
const activeTransfersInFlight = new Map<string, Promise<CachedJsonPayload>>();
const tilesCache = new Map<string, CacheEntry<CachedJsonPayload>>();
const tilesInFlight = new Map<string, Promise<CachedJsonPayload>>();
const hyperstructuresCache = new Map<string, CacheEntry<CachedJsonPayload>>();
const hyperstructuresInFlight = new Map<string, Promise<CachedJsonPayload>>();
const structureExplorerDetailsCache = new Map<string, CacheEntry<CachedJsonPayload>>();
const structureExplorerDetailsInFlight = new Map<string, Promise<CachedJsonPayload>>();

const pruneCache = <T>(cache: Map<string, CacheEntry<T>>, maxEntries: number) => {
  if (cache.size <= maxEntries) {
    return;
  }
  const entries = Array.from(cache.entries()).toSorted((a, b) => a[1].fetchedAt - b[1].fetchedAt);
  const overflow = entries.length - maxEntries;
  for (let i = 0; i < overflow; i += 1) {
    cache.delete(entries[i]![0]);
  }
};

const cleanupExpiredEntries = <T>(cache: Map<string, CacheEntry<T>>, staleMs: number) => {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  for (const [key, entry] of cache.entries()) {
    const age = now - entry.fetchedAt;
    if (age > staleMs) {
      entriesToDelete.push(key);
    }
  }

  for (const key of entriesToDelete) {
    cache.delete(key);
  }

  if (entriesToDelete.length > 0) {
    console.log(`Cleaned up ${entriesToDelete.length} expired cache entries`);
  }
};

let cacheCleanupIntervalId: NodeJS.Timeout | null = null;

const startCacheCleanup = () => {
  if (cacheCleanupIntervalId) {
    return;
  }

  cacheCleanupIntervalId = setInterval(
    () => {
      cleanupExpiredEntries(leaderboardCache, leaderboardStaleMs);
      cleanupExpiredEntries(storyEventsCache, storyEventsStaleMs);
      cleanupExpiredEntries(activeTransfersCache, activeTransfersStaleMs);
      cleanupExpiredEntries(tilesCache, tilesStaleMs);
      cleanupExpiredEntries(hyperstructuresCache, hyperstructuresStaleMs);
      cleanupExpiredEntries(structureExplorerDetailsCache, structureExplorerDetailsStaleMs);
    },
    10 * 60 * 1000,
  );
};

if (cacheEnabled) {
  startCacheCleanup();
}

const sendJsonBody = (c: Context, payload: CachedJsonPayload, status: number = 200) => {
  return createCachedJsonResponse({
    payload,
    status,
    acceptEncoding: c.req.header("Accept-Encoding"),
    headers: c.res.headers,
  });
};

const logCacheMetrics = ({
  name,
  status,
  totalMs,
  fetchMs,
  ageMs,
  extra,
}: {
  name: string;
  status: CacheStatus;
  totalMs: number;
  fetchMs: number | null;
  ageMs: number | null;
  extra?: string;
}) => {
  const parts = [`[cache] ${name}`, `status=${status}`, `totalMs=${Math.round(totalMs)}ms`];
  if (fetchMs !== null) {
    parts.push(`fetchMs=${Math.round(fetchMs)}ms`);
  }
  if (ageMs !== null) {
    parts.push(`ageMs=${Math.max(0, Math.round(ageMs))}ms`);
  }
  if (extra) {
    parts.push(extra);
  }
  console.log(parts.join(" "));
};

const buildSqlUrl = (baseUrl: string, query: string): string => {
  const url = new URL(baseUrl);
  url.searchParams.set("query", query);
  return url.toString();
};

const fetchToriiRows = async <T>(baseUrl: string, query: string, context: string): Promise<T[]> => {
  const url = buildSqlUrl(baseUrl, query);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${context}: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (!Array.isArray(result)) {
    throw new Error(`${context}: expected array response`);
  }

  return result as T[];
};

const parseActiveTransferNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("0x")) {
    return Number(BigInt(trimmed));
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseActiveTransferPositiveInteger = (value: unknown): number | null => {
  const parsed = parseActiveTransferNumber(value);
  if (parsed === null) {
    return null;
  }

  const integer = Math.floor(parsed);
  return integer > 0 ? integer : null;
};

const parseActiveTransferResourceIds = (raw: unknown): number[] => {
  const parseMaybeJson = (value: unknown): unknown => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
      return value;
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return value;
    }
  };

  const parsed = parseMaybeJson(raw);
  const resourceCandidates = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? Object.values(parsed as Record<string, unknown>)
      : [];

  const resourceIds = resourceCandidates
    .map((entry) => {
      if (Array.isArray(entry)) {
        return parseActiveTransferPositiveInteger(entry[0]);
      }

      if (!entry || typeof entry !== "object") {
        return null;
      }

      const candidate = entry as { resourceId?: unknown; resource?: unknown };
      return parseActiveTransferPositiveInteger(candidate.resourceId ?? candidate.resource);
    })
    .filter((resourceId): resourceId is number => resourceId !== null);

  return Array.from(new Set(resourceIds));
};

const normalizeActiveTransfers = (
  rows: ActiveTransferCacheRow[],
  currentTimeMs: number,
): ActiveTransferCachePayload[] =>
  rows
    .map((row): ActiveTransferCachePayload | null => {
      const sourceEntityId = parseActiveTransferPositiveInteger(row.resource_transfer_from_entity_id);
      const destinationEntityId = parseActiveTransferPositiveInteger(row.resource_transfer_to_entity_id);
      const startedAtSeconds = parseActiveTransferNumber(row.timestamp);
      const travelTimeSeconds = parseActiveTransferNumber(row.resource_transfer_travel_time);
      const resourceIds = parseActiveTransferResourceIds(row.resource_transfer_resources);

      if (
        sourceEntityId === null ||
        destinationEntityId === null ||
        startedAtSeconds === null ||
        travelTimeSeconds === null ||
        travelTimeSeconds <= 0 ||
        resourceIds.length === 0
      ) {
        return null;
      }

      const startedAtMs = startedAtSeconds * 1000;
      const endsAtMs = startedAtMs + travelTimeSeconds * 1000;
      if (currentTimeMs >= endsAtMs) {
        return null;
      }

      const transferId =
        row.event_id ?? row.id ?? row.tx_hash ?? `${sourceEntityId}-${destinationEntityId}-${startedAtMs}`;

      return {
        id: `live:${transferId}`,
        eventId: row.event_id ?? undefined,
        txHash: row.tx_hash ?? undefined,
        sourceEntityId,
        destinationEntityId,
        resourceIds,
        startedAtMs,
        endsAtMs,
        progress: Math.max(0, Math.min((currentTimeMs - startedAtMs) / (travelTimeSeconds * 1000), 1)),
      };
    })
    .filter((transfer): transfer is ActiveTransferCachePayload => transfer !== null);

const getCachedValue = async <T>({
  cache,
  inFlight,
  key,
  ttlMs,
  staleMs,
  maxEntries,
  fetcher,
}: {
  cache: Map<string, CacheEntry<T>>;
  inFlight: Map<string, Promise<T>>;
  key: string;
  ttlMs: number;
  staleMs: number;
  maxEntries: number;
  fetcher: () => Promise<T>;
}): Promise<CacheResult<T>> => {
  if (!cacheEnabled) {
    const value = await fetcher();
    return { value, status: "miss", fetchedAt: Date.now() };
  }

  const now = Date.now();
  const entry = cache.get(key);

  if (entry) {
    const age = now - entry.fetchedAt;
    if (age <= ttlMs) {
      return { value: entry.value, status: "hit", fetchedAt: entry.fetchedAt };
    }
    if (age <= staleMs) {
      if (!inFlight.has(key)) {
        const refresh = fetcher()
          .then((value) => {
            cache.set(key, { value, fetchedAt: Date.now() });
            pruneCache(cache, maxEntries);
            return value;
          })
          .catch((error) => {
            console.error(`Background cache refresh failed for key "${key}":`, error);
            return entry.value;
          })
          .finally(() => {
            inFlight.delete(key);
          });
        inFlight.set(key, refresh);
      }
      return { value: entry.value, status: "stale", fetchedAt: entry.fetchedAt };
    }
  }

  const existingRequest = inFlight.get(key);
  if (existingRequest) {
    const value = await existingRequest;
    const cached = cache.get(key);
    return {
      value,
      status: "miss",
      fetchedAt: cached?.fetchedAt ?? now,
    };
  }

  const refresh = fetcher()
    .then((value) => {
      cache.set(key, { value, fetchedAt: Date.now() });
      pruneCache(cache, maxEntries);
      return value;
    })
    .catch((error) => {
      console.error(`Cache refresh failed for key "${key}":`, error);
      throw error;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, refresh);

  const value = await refresh;
  const cached = cache.get(key);
  return {
    value,
    status: "miss",
    fetchedAt: cached?.fetchedAt ?? now,
  };
};

const normalizeToriiBaseUrl = (value: string | undefined, appendSql: boolean): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.search = "";
    url.hash = "";

    const basePath = url.pathname.replace(/\/+$/, "");
    const normalizedBasePath = basePath === "" ? "/" : basePath;

    if (appendSql) {
      url.pathname = normalizedBasePath.endsWith("/sql") ? normalizedBasePath : `${normalizedBasePath}/sql`;
    } else {
      url.pathname = normalizedBasePath;
    }

    return url.toString();
  } catch {
    return null;
  }
};

const resolveToriiSqlBaseUrl = (c: Context): string | null => {
  const querySqlBase = c.req.query("toriiSqlBaseUrl");
  const queryBase = c.req.query("toriiBaseUrl");

  const normalizedFromQuery = normalizeToriiBaseUrl(querySqlBase, false) ?? normalizeToriiBaseUrl(queryBase, true);

  if (normalizedFromQuery) {
    return normalizedFromQuery;
  }

  return normalizeToriiBaseUrl(process.env.TORII_SQL_BASE_URL, false);
};

const cacheRoutes = new Hono<AppEnv>();

cacheRoutes.get("/leaderboard", async (c) => {
  const start = Date.now();
  const toriiBaseUrl = resolveToriiSqlBaseUrl(c);
  if (!toriiBaseUrl) {
    return c.json({ error: "Torii SQL base URL missing. Provide toriiSqlBaseUrl or set TORII_SQL_BASE_URL." }, 400);
  }

  const limitRaw = c.req.query("limit");
  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : leaderboardLimitDefault;
  const limit = limitParsed <= 0 ? 0 : clampNumber(limitParsed, 1, leaderboardLimitMax);
  const cacheKey = limit <= 0 ? `${toriiBaseUrl}|all` : `${toriiBaseUrl}|limit:${limit}`;

  try {
    let fetchMs: number | null = null;
    const result = await getCachedValue({
      cache: leaderboardCache,
      inFlight: leaderboardInFlight,
      key: cacheKey,
      ttlMs: leaderboardTtlMs,
      staleMs: leaderboardStaleMs,
      maxEntries: leaderboardMaxEntries,
      fetcher: async () => {
        const fetchStart = Date.now();
        try {
          const leaderboardQuery = buildLeaderboardQuery(limit <= 0 ? undefined : limit);
          const [registeredRows, hyperstructureShareholderRows, hyperstructureRows, hyperstructureConfigRows] =
            await Promise.all([
              fetchToriiRows<unknown>(toriiBaseUrl, leaderboardQuery, "leaderboard"),
              fetchToriiRows<unknown>(toriiBaseUrl, HYPERSTRUCTURE_SHAREHOLDERS_QUERY, "hyperstructure shareholders"),
              fetchToriiRows<unknown>(
                toriiBaseUrl,
                HYPERSTRUCTURES_WITH_MULTIPLIER_QUERY,
                "hyperstructure multipliers",
              ),
              fetchToriiRows<unknown>(toriiBaseUrl, HYPERSTRUCTURE_LEADERBOARD_CONFIG_QUERY, "hyperstructure config"),
            ]);

          const payload: LeaderboardCachePayload = {
            registeredRows,
            hyperstructureShareholderRows,
            hyperstructureRows,
            hyperstructureConfigRow: hyperstructureConfigRows[0],
          };

          return createJsonPayload(payload);
        } finally {
          fetchMs = Date.now() - fetchStart;
        }
      },
    });

    logCacheMetrics({
      name: "leaderboard",
      status: result.status,
      totalMs: Date.now() - start,
      fetchMs,
      ageMs: Date.now() - result.fetchedAt,
      extra: `limit=${limit}`,
    });
    c.header("x-cache", result.status);
    return sendJsonBody(c, result.value);
  } catch (error) {
    console.error("Failed to fetch leaderboard cache", error);
    return c.json({ error: "Failed to fetch leaderboard cache." }, 500);
  }
});

cacheRoutes.get("/story-events", async (c) => {
  const start = Date.now();
  const toriiBaseUrl = resolveToriiSqlBaseUrl(c);
  if (!toriiBaseUrl) {
    return c.json({ error: "Torii SQL base URL missing. Provide toriiSqlBaseUrl or set TORII_SQL_BASE_URL." }, 400);
  }

  const limitRaw = c.req.query("limit");
  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : storyEventsLimitDefault;
  if (limitParsed <= 0) {
    logCacheMetrics({
      name: "story-events",
      status: "hit",
      totalMs: Date.now() - start,
      fetchMs: null,
      ageMs: null,
      extra: "limit=0",
    });
    c.header("x-cache", "hit");
    return sendJsonBody(c, createJsonPayload([]));
  }

  const limit = clampNumber(limitParsed, 1, storyEventsLimitMax);
  const offsetRaw = c.req.query("offset");
  const offsetParsed = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;
  const offset = clampNumber(offsetParsed, 0, Number.MAX_SAFE_INTEGER);
  const cacheKey = `${toriiBaseUrl}|limit:${limit}|offset:${offset}`;

  try {
    let fetchMs: number | null = null;
    const result = await getCachedValue({
      cache: storyEventsCache,
      inFlight: storyEventsInFlight,
      key: cacheKey,
      ttlMs: storyEventsTtlMs,
      staleMs: storyEventsStaleMs,
      maxEntries: storyEventsMaxEntries,
      fetcher: async () => {
        const fetchStart = Date.now();
        try {
          const query = buildStoryEventsQuery(limit, offset);
          const rows = await fetchToriiRows<unknown>(toriiBaseUrl, query, "story events");
          return createJsonPayload(rows);
        } finally {
          fetchMs = Date.now() - fetchStart;
        }
      },
    });

    logCacheMetrics({
      name: "story-events",
      status: result.status,
      totalMs: Date.now() - start,
      fetchMs,
      ageMs: Date.now() - result.fetchedAt,
      extra: `limit=${limit} offset=${offset}`,
    });
    c.header("x-cache", result.status);
    return sendJsonBody(c, result.value);
  } catch (error) {
    console.error("Failed to fetch story events cache", error);
    return c.json({ error: "Failed to fetch story events cache." }, 500);
  }
});

cacheRoutes.get("/active-transfers", async (c) => {
  const start = Date.now();
  const toriiBaseUrl = resolveToriiSqlBaseUrl(c);
  if (!toriiBaseUrl) {
    return c.json({ error: "Torii SQL base URL missing. Provide toriiSqlBaseUrl or set TORII_SQL_BASE_URL." }, 400);
  }

  const limitRaw = c.req.query("limit");
  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : activeTransfersLimitDefault;
  if (limitParsed <= 0) {
    logCacheMetrics({
      name: "active-transfers",
      status: "hit",
      totalMs: Date.now() - start,
      fetchMs: null,
      ageMs: null,
      extra: "limit=0",
    });
    c.header("x-cache", "hit");
    return sendJsonBody(c, createJsonPayload([]));
  }

  const limit = clampNumber(limitParsed, 1, activeTransfersLimitMax);
  const lookbackRaw = c.req.query("lookbackSeconds");
  const lookbackParsed = lookbackRaw ? Number.parseInt(lookbackRaw, 10) : activeTransfersLookbackSecondsDefault;
  const lookbackSeconds = clampNumber(lookbackParsed, 1, activeTransfersLookbackSecondsMax);
  const cacheKey = `${toriiBaseUrl}|limit:${limit}|lookbackSeconds:${lookbackSeconds}`;

  try {
    let fetchMs: number | null = null;
    const result = await getCachedValue({
      cache: activeTransfersCache,
      inFlight: activeTransfersInFlight,
      key: cacheKey,
      ttlMs: activeTransfersTtlMs,
      staleMs: activeTransfersStaleMs,
      maxEntries: activeTransfersMaxEntries,
      fetcher: async () => {
        const fetchStart = Date.now();
        try {
          const currentTimeMs = Date.now();
          const query = buildActiveTransfersQuery({
            limit,
            minTimestampSeconds: Math.max(0, Math.floor(currentTimeMs / 1000) - lookbackSeconds),
          });
          const rows = await fetchToriiRows<ActiveTransferCacheRow>(toriiBaseUrl, query, "active transfers");
          return createJsonPayload(normalizeActiveTransfers(rows, currentTimeMs));
        } finally {
          fetchMs = Date.now() - fetchStart;
        }
      },
    });

    logCacheMetrics({
      name: "active-transfers",
      status: result.status,
      totalMs: Date.now() - start,
      fetchMs,
      ageMs: Date.now() - result.fetchedAt,
      extra: `limit=${limit} lookbackSeconds=${lookbackSeconds}`,
    });
    c.header("x-cache", result.status);
    return sendJsonBody(c, result.value);
  } catch (error) {
    console.error("Failed to fetch active transfers cache", error);
    return c.json({ error: "Failed to fetch active transfers cache." }, 500);
  }
});

cacheRoutes.get("/tiles", async (c) => {
  const start = Date.now();
  const toriiBaseUrl = resolveToriiSqlBaseUrl(c);
  if (!toriiBaseUrl) {
    return c.json({ error: "Torii SQL base URL missing. Provide toriiSqlBaseUrl or set TORII_SQL_BASE_URL." }, 400);
  }

  const cacheKey = `${toriiBaseUrl}|all`;

  try {
    let fetchMs: number | null = null;
    const result = await getCachedValue({
      cache: tilesCache,
      inFlight: tilesInFlight,
      key: cacheKey,
      ttlMs: tilesTtlMs,
      staleMs: tilesStaleMs,
      maxEntries: tilesMaxEntries,
      fetcher: async () => {
        const fetchStart = Date.now();
        try {
          const rows = await fetchToriiRows<unknown>(toriiBaseUrl, ALL_TILES_QUERY, "tiles");
          return createJsonPayload(rows);
        } finally {
          fetchMs = Date.now() - fetchStart;
        }
      },
    });

    logCacheMetrics({
      name: "tiles",
      status: result.status,
      totalMs: Date.now() - start,
      fetchMs,
      ageMs: Date.now() - result.fetchedAt,
    });
    c.header("x-cache", result.status);
    return sendJsonBody(c, result.value);
  } catch (error) {
    console.error("Failed to fetch tiles cache", error);
    return c.json({ error: "Failed to fetch tiles cache." }, 500);
  }
});

cacheRoutes.get("/hyperstructures", async (c) => {
  const start = Date.now();
  const toriiBaseUrl = resolveToriiSqlBaseUrl(c);
  if (!toriiBaseUrl) {
    return c.json({ error: "Torii SQL base URL missing. Provide toriiSqlBaseUrl or set TORII_SQL_BASE_URL." }, 400);
  }

  const cacheKey = `${toriiBaseUrl}|all`;

  try {
    let fetchMs: number | null = null;
    const result = await getCachedValue({
      cache: hyperstructuresCache,
      inFlight: hyperstructuresInFlight,
      key: cacheKey,
      ttlMs: hyperstructuresTtlMs,
      staleMs: hyperstructuresStaleMs,
      maxEntries: hyperstructuresMaxEntries,
      fetcher: async () => {
        const fetchStart = Date.now();
        try {
          const rows = await fetchToriiRows<unknown>(toriiBaseUrl, HYPERSTRUCTURES_QUERY, "hyperstructures");
          return createJsonPayload(rows);
        } finally {
          fetchMs = Date.now() - fetchStart;
        }
      },
    });

    logCacheMetrics({
      name: "hyperstructures",
      status: result.status,
      totalMs: Date.now() - start,
      fetchMs,
      ageMs: Date.now() - result.fetchedAt,
    });
    c.header("x-cache", result.status);
    return sendJsonBody(c, result.value);
  } catch (error) {
    console.error("Failed to fetch hyperstructures cache", error);
    return c.json({ error: "Failed to fetch hyperstructures cache." }, 500);
  }
});

cacheRoutes.get("/structure-explorer-details", async (c) => {
  const start = Date.now();
  const toriiBaseUrl = resolveToriiSqlBaseUrl(c);
  if (!toriiBaseUrl) {
    return c.json({ error: "Torii SQL base URL missing. Provide toriiSqlBaseUrl or set TORII_SQL_BASE_URL." }, 400);
  }

  const cacheKey = `${toriiBaseUrl}|all`;

  try {
    let fetchMs: number | null = null;
    const result = await getCachedValue({
      cache: structureExplorerDetailsCache,
      inFlight: structureExplorerDetailsInFlight,
      key: cacheKey,
      ttlMs: structureExplorerDetailsTtlMs,
      staleMs: structureExplorerDetailsStaleMs,
      maxEntries: structureExplorerDetailsMaxEntries,
      fetcher: async () => {
        const fetchStart = Date.now();
        try {
          const rows = await fetchToriiRows<unknown>(
            toriiBaseUrl,
            STRUCTURE_AND_EXPLORER_DETAILS_QUERY,
            "structure explorer details",
          );
          return createJsonPayload(rows);
        } finally {
          fetchMs = Date.now() - fetchStart;
        }
      },
    });

    logCacheMetrics({
      name: "structure-explorer-details",
      status: result.status,
      totalMs: Date.now() - start,
      fetchMs,
      ageMs: Date.now() - result.fetchedAt,
    });
    c.header("x-cache", result.status);
    return sendJsonBody(c, result.value);
  } catch (error) {
    console.error("Failed to fetch structure explorer details cache", error);
    return c.json({ error: "Failed to fetch structure explorer details cache." }, 500);
  }
});

export default cacheRoutes;
