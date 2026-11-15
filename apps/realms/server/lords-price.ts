import { json } from "./http";

const SECONDS_PER_DAY = 86_400;
/** The cron runs every minute; an unanswered read is tried again every 10 minutes, not every minute. */
const RETRY_MINUTES = 10;

/** LORDS's price in dollars, from the market; throws when the market cannot say. */
export type LordsPriceReader = () => Promise<number>;

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

/** The price the shop quotes: dollars a LORDS, the day it was read for and when. */
export interface LordsPrice {
  usd: number;
  day: number;
  readAt: number;
}

/** The newest price read, kept however old; null before the first read. */
export const latestLordsPrice = async (db: D1Database): Promise<LordsPrice | null> => {
  const row = await db
    .prepare('SELECT "usd", "day", "read_at" FROM "lords_price" ORDER BY "day" DESC LIMIT 1')
    .first<{ usd: number; day: number; read_at: number }>();
  return row ? { usd: row.usd, day: row.day, readAt: row.read_at } : null;
};

/**
 * The cron's step: the UTC day's price is read once and kept. A read that fails or is not a positive number writes
 * nothing, so the last price stands; safe to run again, and a day with a price reads nothing.
 */
export const refreshLordsPrice = async (
  db: D1Database,
  read: LordsPriceReader,
  now: number,
): Promise<"read" | "held" | "kept" | "waiting"> => {
  const day = Math.floor(now / SECONDS_PER_DAY);
  const held = await db.prepare('SELECT 1 AS "held" FROM "lords_price" WHERE "day" = ?').bind(day).first();
  if (held) return "held";
  if (Math.floor(now / 60) % RETRY_MINUTES !== 0 && (await latestLordsPrice(db))) return "waiting";
  try {
    const usd = await read();
    if (!(usd > 0)) throw new Error("LORDS price is not positive");
    await db
      .prepare('INSERT INTO "lords_price" ("day", "usd", "read_at") VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
      .bind(day, usd, now)
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
