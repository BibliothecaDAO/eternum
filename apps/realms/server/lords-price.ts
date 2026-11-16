import { gameDayStarts } from "./day-open";
import { fetchShardGames, gamesUrl, listedShards } from "./directory";
import { json } from "./http";
import type { IdentityAuth } from "./auth";
import { authorizeShop, gameKey, namedGame, type ShopAccess } from "./shop-game";

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

/** One price day: which calendar set it ("chain:game", or "utc"), when it starts and when it ends (seconds). */
export interface PriceDay {
  calendar: string;
  start: number;
  end: number;
}

/** The price the shop quotes: dollars a LORDS, the interval of the price day it was read for, and when the market was read. */
interface LordsPrice {
  usd: number;
  dayStart: number;
  dayEnd: number;
  readAt: number;
}

const DAY_SECONDS = 86_400;

/**
 * The price day to open now, or null while it cannot be known. One calendar decides it: the running Frontier game with
 * the lowest id sets the day (ties between shards by chain), and when no Frontier game runs on any listed shard the UTC
 * day does. A listed shard that cannot be read leaves the answer unknown, so no day opens on a guess.
 */
export const readPriceDay = async (
  db: D1Database,
  now: number,
  get: typeof fetch = fetch,
): Promise<PriceDay | null> => {
  const reads = await Promise.all(
    (await listedShards(db)).map(async (shard) => {
      try {
        const chainId = gameKey(shard.chainId);
        const games = await fetchShardGames(shard, gamesUrl(shard, null), get);
        return gameDayStarts(games, now).map((day) => ({ chainId, ...day }));
      } catch (error) {
        console.error(`[lords price] shard ${shard.url} games unread; no price day opens`, error);
        return null;
      }
    }),
  );
  if (reads.includes(null)) return null;
  const [first] = reads
    .flat()
    .sort((a, b) => a!.gameId - b!.gameId || (a!.chainId < b!.chainId ? -1 : a!.chainId > b!.chainId ? 1 : 0));
  if (first) return { calendar: `${first.chainId}:${first.gameId}`, start: first.dayStart, end: first.dayEnd };
  const start = Math.floor(now / DAY_SECONDS) * DAY_SECONDS;
  return { calendar: "utc", start, end: start + DAY_SECONDS };
};

/** The one price day that covers `now` by the clock, or null; at most one can, because a day opens only when none does. */
const dayCovering = (db: D1Database, now: number) =>
  db
    .prepare(
      'SELECT "day_start", "day_end", "usd", "read_at" FROM "lords_price" WHERE "day_start" <= ?1 AND "day_end" > ?1',
    )
    .bind(now)
    .first<{ day_start: number; day_end: number; usd: number | null; read_at: number | null }>();

/** Opens a day in one statement: only when no day ends after `now`, so a second writer or an older refresh writes nothing. */
const openDay = (db: D1Database, day: PriceDay, now: number) =>
  db
    .prepare(
      `INSERT INTO "lords_price" ("day_start", "day_end", "calendar")
       SELECT ?1, ?2, ?3 WHERE NOT EXISTS (SELECT 1 FROM "lords_price" WHERE "day_end" > ?4)
       ON CONFLICT ("day_start") DO NOTHING`,
    )
    .bind(day.start, day.end, day.calendar, now)
    .run();

/**
 * The cron's step. When no price day covers `now` it asks the calendar once and opens that day; while a day covers `now`
 * the calendar is not read, so the running set cannot change a day's calendar. A day with no price is read on every run
 * until a read succeeds; the first success is kept and never replaced, and a read that fails or is not a positive
 * number writes nothing. Safe to run again, and an older run cannot open or fill a day that is no longer current.
 */
export const refreshLordsPrice = async (
  db: D1Database,
  read: LordsPriceReader,
  now: number,
  calendar: () => Promise<PriceDay | null>,
): Promise<"read" | "held" | "kept"> => {
  let day = await dayCovering(db, now);
  if (!day) {
    const next = await calendar();
    if (next) await openDay(db, next, now);
    day = await dayCovering(db, now);
  }
  if (!day || day.usd !== null) return "held";
  try {
    const usd = await read();
    if (!(usd > 0)) throw new Error("LORDS price is not positive");
    await db
      .prepare(
        'UPDATE "lords_price" SET "usd" = ?, "read_at" = ? WHERE "day_start" = ? AND "usd" IS NULL AND "day_end" > ?',
      )
      .bind(usd, now, day.day_start, now)
      .run();
    return "read";
  } catch (error) {
    console.error("[lords price] the market read failed; the day stays unpriced and is tried again", error);
    return "kept";
  }
};

/** What the price route reads: D1, the shop's rule and the clock (seconds). */
interface PriceWorld {
  db: D1Database;
  access: ShopAccess;
  now: () => number;
}

/** The one reader of the shop's price: the price of the day that covers `now`, or null when none does or it has no read yet. */
export const currentLordsPrice = async (db: D1Database, now: number): Promise<LordsPrice | null> => {
  const day = await dayCovering(db, now);
  return day?.usd != null && day.read_at !== null
    ? { usd: day.usd, dayStart: day.day_start, dayEnd: day.day_end, readAt: day.read_at }
    : null;
};

/**
 * GET /api/shop/price?chain=&game=: the one LORDS price in dollars, to a signed-in player of a running Frontier game, with
 * the interval of its price day and `readAt`, when the market was read (after the day started when the first read had to
 * be retried). Outside a priced day's interval the answer is 503 `no_price_now`: never an ended or unknown price.
 */
export const handleLordsPrice = async (request: Request, auth: IdentityAuth, world: PriceWorld): Promise<Response> => {
  const url = new URL(request.url);
  const seat = await authorizeShop(
    request,
    auth,
    world.access,
    namedGame(url.searchParams.get("chain"), url.searchParams.get("game")),
  );
  if (seat instanceof Response) return seat;
  const price = await currentLordsPrice(world.db, world.now());
  return price ? json(price) : json({ error: "no_price_now" }, 503);
};
