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

/** The price the shop quotes: dollars a LORDS, the start (seconds) of the price day it was read for, and when. */
interface LordsPrice {
  usd: number;
  dayStart: number;
  readAt: number;
}

const DAY_SECONDS = 86_400;

/** One running Frontier game's current day. */
interface RunningGameDay {
  chainId: string;
  gameId: number;
  dayStart: number;
}

/**
 * The start of the price day, or null while it cannot be known. One calendar decides it: the running Frontier game with
 * the lowest id sets the day (ties between shards by chain), and when no Frontier game runs on any listed shard the UTC
 * day does. A listed shard that cannot be read leaves the answer unknown, so the price day never flips between two
 * calendars on an outage.
 */
export const readPriceDay = async (db: D1Database, now: number, get: typeof fetch = fetch): Promise<number | null> => {
  const reads = await Promise.all(
    (await listedShards(db)).map(async (shard) => {
      try {
        const chainId = gameKey(shard.chainId);
        const games = await fetchShardGames(shard, gamesUrl(shard, null), get);
        return gameDayStarts(games, now).map((day): RunningGameDay => ({ chainId, ...day }));
      } catch (error) {
        console.error(`[lords price] shard ${shard.url} games unread; the price day stays as it was`, error);
        return null;
      }
    }),
  );
  if (reads.includes(null)) return null;
  const [first] = reads
    .flat()
    .sort((a, b) => a!.gameId - b!.gameId || (a!.chainId < b!.chainId ? -1 : a!.chainId > b!.chainId ? 1 : 0));
  return first ? first.dayStart : Math.floor(now / DAY_SECONDS) * DAY_SECONDS;
};

/** The newest price day: the one the shop quotes. Its price is null until the first successful read of that day. */
const currentDay = (db: D1Database) =>
  db
    .prepare('SELECT "id", "day_start", "usd", "read_at" FROM "lords_price" ORDER BY "id" DESC LIMIT 1')
    .first<{ id: number; day_start: number; usd: number | null; read_at: number | null }>();

/**
 * The cron's step: open the price day when it has changed, and read the price for a day that has none, on every run from
 * the day's start until a read succeeds. The day's price is that first successful read and is never replaced; a read that
 * fails or is not a positive number writes nothing, so the day stays unpriced and the shop says so. Safe to run again.
 */
export const refreshLordsPrice = async (
  db: D1Database,
  read: LordsPriceReader,
  now: number,
  priceDay: number | null,
): Promise<"read" | "held" | "kept"> => {
  let day = await currentDay(db);
  if (priceDay !== null && day?.day_start !== priceDay) {
    await db.prepare('INSERT INTO "lords_price" ("day_start") VALUES (?)').bind(priceDay).run();
    day = await currentDay(db);
  }
  if (!day || day.usd !== null) return "held";
  try {
    const usd = await read();
    if (!(usd > 0)) throw new Error("LORDS price is not positive");
    await db
      .prepare('UPDATE "lords_price" SET "usd" = ?, "read_at" = ? WHERE "id" = ? AND "usd" IS NULL')
      .bind(usd, now, day.id)
      .run();
    return "read";
  } catch (error) {
    console.error("[lords price] the market read failed; the day stays unpriced and is tried again", error);
    return "kept";
  }
};

/** What the price route reads: D1 and the shop's rule. */
interface PriceWorld {
  db: D1Database;
  access: ShopAccess;
}

/**
 * GET /api/shop/price?chain=&game=: the one LORDS price in dollars, with the start of the price day it was read for, to a
 * signed-in player of a running Frontier game. While the current day has no price the answer is 503 `price_not_read_yet`
 * with the day's start: an earlier day's price is never given as today's.
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
  const day = await currentDay(world.db);
  if (!day) return json({ error: "price_not_read_yet", dayStart: null }, 503);
  if (day.usd === null || day.read_at === null)
    return json({ error: "price_not_read_yet", dayStart: day.day_start }, 503);
  return json({ usd: day.usd, dayStart: day.day_start, readAt: day.read_at } satisfies LordsPrice);
};
