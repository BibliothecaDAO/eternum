import { gameDayStarts } from "./day-open";
import { fetchShardGames, gamesUrl, listedShards } from "./directory";
import { json } from "./http";

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

/** One running game's current day: the game's shard chain, its id, and when the day opened (seconds). */
interface RunningGameDay {
  chainId: string;
  gameId: number;
  dayStart: number;
}

/** The price the shop quotes: dollars a LORDS, the start (seconds) of the game day it was read for, and when. */
interface LordsPrice {
  usd: number;
  dayStart: number;
  readAt: number;
}

const gameKey = (chainId: string) => `0x${BigInt(chainId).toString(16)}`;

/**
 * The price quoted to a player of one game: the newest read of that game's days, kept however old, so it holds until the
 * game's next day has a price of its own. Null while that game has none.
 */
const priceOfGame = async (db: D1Database, chainId: string, gameId: number): Promise<LordsPrice | null> => {
  const row = await db
    .prepare(
      'SELECT "usd", "day_start", "read_at" FROM "lords_price" WHERE "chain_id" = ? AND "game_id" = ? ORDER BY "day_start" DESC LIMIT 1',
    )
    .bind(gameKey(chainId), gameId)
    .first<{ usd: number; day_start: number; read_at: number }>();
  return row ? { usd: row.usd, dayStart: row.day_start, readAt: row.read_at } : null;
};

const anyPrice = (db: D1Database) => db.prepare('SELECT 1 AS "any" FROM "lords_price" LIMIT 1').first();

/** What the cron read: every running game's current day, and the chains whose game lists were read in full. */
interface ShopCalendar {
  days: RunningGameDay[];
  readChains: string[];
}

/**
 * The current day of every running Frontier game on a listed shard. A shard that cannot be read says so in the log and
 * contributes nothing: an unreadable calendar is unknown, never "no game runs", and nothing is priced or dropped for it.
 */
export const readShopCalendar = async (
  db: D1Database,
  now: number,
  get: typeof fetch = fetch,
): Promise<ShopCalendar> => {
  const reads = await Promise.all(
    (await listedShards(db)).map(async (shard) => {
      try {
        const games = await fetchShardGames(shard, gamesUrl(shard, null), get);
        const chainId = gameKey(shard.chainId);
        return { chainId, days: gameDayStarts(games, now).map((day) => ({ chainId, ...day })) };
      } catch (error) {
        console.error(`[lords price] shard ${shard.url} games unread; its games get no new price`, error);
        return null;
      }
    }),
  );
  const read = reads.flatMap((one) => one ?? []);
  return { days: read.flatMap(({ days }) => days), readChains: read.map(({ chainId }) => chainId) };
};

/** A game that no longer runs has no shop: its prices go, on a chain whose games were read and did not list it. */
const dropEndedGames = async (db: D1Database, { days, readChains }: ShopCalendar) => {
  const { results } = await db.prepare('SELECT DISTINCT "chain_id", "game_id" FROM "lords_price"').all<{
    chain_id: string;
    game_id: number;
  }>();
  const ended = results.filter(
    (row) =>
      readChains.includes(row.chain_id) &&
      !days.some((day) => day.chainId === row.chain_id && day.gameId === row.game_id),
  );
  if (ended.length === 0) return;
  await db.batch(
    ended.map((row) =>
      db.prepare('DELETE FROM "lords_price" WHERE "chain_id" = ? AND "game_id" = ?').bind(row.chain_id, row.game_id),
    ),
  );
};

/**
 * The cron's step: each running game's day is priced once, at the start of that day, and kept. A read that fails or is
 * not a positive number writes nothing, so each game's last price stands; safe to run again, and a day with a price reads
 * nothing.
 */
export const refreshLordsPrice = async (
  db: D1Database,
  read: LordsPriceReader,
  now: number,
  calendar: ShopCalendar,
): Promise<"read" | "held" | "kept" | "waiting"> => {
  await dropEndedGames(db, calendar);
  const unpriced: RunningGameDay[] = [];
  for (const day of calendar.days) {
    const held = await db
      .prepare('SELECT 1 AS "held" FROM "lords_price" WHERE "chain_id" = ? AND "game_id" = ? AND "day_start" = ?')
      .bind(gameKey(day.chainId), day.gameId, day.dayStart)
      .first();
    if (!held) unpriced.push(day);
  }
  if (unpriced.length === 0) return "held";
  if (Math.floor(now / 60) % RETRY_MINUTES !== 0 && (await anyPrice(db))) return "waiting";
  try {
    const usd = await read();
    if (!(usd > 0)) throw new Error("LORDS price is not positive");
    await db.batch(
      unpriced.map((day) =>
        db
          .prepare(
            'INSERT INTO "lords_price" ("chain_id", "game_id", "day_start", "usd", "read_at") VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
          )
          .bind(gameKey(day.chainId), day.gameId, day.dayStart, usd, now),
      ),
    );
    return "read";
  } catch (error) {
    console.error("[lords price] the market read failed; the last price stands", error);
    return "kept";
  }
};

/**
 * GET /api/shop/price?chain=&game=: the LORDS price in dollars read at the start of that game's current day, held until
 * its next day has one. The shop exists only inside a running Frontier game: no game named, or a game with no price (not
 * running, or not priced yet), is 404 `no_shop_outside_a_frontier_game`; there is no other price to give.
 */
export const handleLordsPrice = async (db: D1Database, url: URL): Promise<Response> => {
  const game = gameOf(url);
  if (game === "invalid") return json({ error: "invalid_game" }, 400);
  const price = game && (await priceOfGame(db, game.chainId, game.gameId));
  return price ? json(price) : json({ error: "no_shop_outside_a_frontier_game" }, 404);
};

const gameOf = (url: URL): { chainId: string; gameId: number } | null | "invalid" => {
  const chain = url.searchParams.get("chain");
  const game = url.searchParams.get("game");
  if (chain === null && game === null) return null;
  const gameId = Number(game);
  try {
    if (chain === null || !Number.isSafeInteger(gameId) || gameId <= 0) return "invalid";
    return { chainId: gameKey(chain), gameId };
  } catch {
    return "invalid";
  }
};
