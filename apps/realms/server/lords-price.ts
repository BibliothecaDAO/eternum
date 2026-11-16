import type { HeraldGameDirectory } from "@bibliothecadao/eternum/game-sync";

import { latestGameDayStart } from "./day-open";
import { json } from "./http";

const SECONDS_PER_DAY = 86_400;
const SHARD_TIMEOUT_MS = 10_000;
/** The cron runs every minute; an unanswered read is tried again every 10 minutes, not every minute. */
const RETRY_MINUTES = 10;

/** LORDS's price in dollars, from the market; throws when the market cannot say. */
type LordsPriceReader = () => Promise<number>;

/** The market's LORDS price in dollars (CoinGecko, as the comeback email reads it). */
export const marketLordsPrice =
  (get: typeof fetch = fetch): LordsPriceReader =>
  async () => {
    const response = await get("https://api.coingecko.com/api/v3/simple/price?ids=lords&vs_currencies=usd", {
      redirect: "manual",
    });
    if (!response.ok) throw new Error(`CoinGecko: ${response.status}`);
    const usd = ((await response.json()) as { lords?: { usd?: unknown } }).lords?.usd;
    if (typeof usd !== "number" || !(usd > 0)) throw new Error("CoinGecko: no LORDS price");
    return usd;
  };

/** The price the shop quotes: dollars a LORDS, the start (seconds) of the game day it was read for, and when. */
interface LordsPrice {
  usd: number;
  dayStart: number;
  readAt: number;
}

/** The newest price read, kept however old; null before the first read. */
export const latestLordsPrice = async (db: D1Database): Promise<LordsPrice | null> => {
  const row = await db
    .prepare('SELECT "usd", "day_start", "read_at" FROM "lords_price" ORDER BY "day_start" DESC LIMIT 1')
    .first<{ usd: number; day_start: number; read_at: number }>();
  return row ? { usd: row.usd, dayStart: row.day_start, readAt: row.read_at } : null;
};

/**
 * The start of the game day the price is read for: when the latest day opened in any running Frontier game on a listed
 * shard, so the price changes once a game day (with several games, whenever one of their days opens). While no game
 * runs, or no shard can say, the UTC day stands in. A shard that cannot be read says so in the log and counts for nothing.
 */
export const priceDayStart = async (db: D1Database, now: number, get: typeof fetch = fetch): Promise<number> => {
  const { results } = await db
    .prepare('SELECT "url" FROM "shards" WHERE "status" NOT IN (\'pending\', \'retired\')')
    .all<{ url: string }>();
  const games = (
    await Promise.all(
      results.map(async ({ url }) => {
        try {
          const response = await get(`${url}/games`, {
            signal: AbortSignal.timeout(SHARD_TIMEOUT_MS),
            redirect: "manual",
          });
          if (!response.ok) throw new Error(`answered ${response.status}`);
          return ((await response.json()) as HeraldGameDirectory).games;
        } catch (error) {
          console.error(`[lords price] shard ${url} games unread; its days do not count`, error);
          return [];
        }
      }),
    )
  ).flat();
  return latestGameDayStart(games, now) ?? Math.floor(now / SECONDS_PER_DAY) * SECONDS_PER_DAY;
};

/**
 * The cron's step: each game day's price is read once and kept (`dayStart` says which day it is). A read that fails or
 * is not a positive number writes nothing, so the last price stands; safe to run again, and a day with a price reads
 * nothing.
 */
export const refreshLordsPrice = async (
  db: D1Database,
  read: LordsPriceReader,
  now: number,
  dayStart: number,
): Promise<"read" | "held" | "kept" | "waiting"> => {
  const held = await db.prepare('SELECT 1 AS "held" FROM "lords_price" WHERE "day_start" = ?').bind(dayStart).first();
  if (held) return "held";
  if (Math.floor(now / 60) % RETRY_MINUTES !== 0 && (await latestLordsPrice(db))) return "waiting";
  try {
    const usd = await read();
    if (!(usd > 0)) throw new Error("LORDS price is not positive");
    await db
      .prepare('INSERT INTO "lords_price" ("day_start", "usd", "read_at") VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
      .bind(dayStart, usd, now)
      .run();
    return "read";
  } catch (error) {
    console.error("[lords price] the market read failed; the last price stands", error);
    return "kept";
  }
};

/** GET /api/shop/price: the day's LORDS price in dollars; 503 until one has been read, never a made-up one. */
export const handleLordsPrice = async (db: D1Database): Promise<Response> => {
  const price = await latestLordsPrice(db);
  return price ? json(price) : json({ error: "lords_price_unavailable" }, 503);
};
