import { afterEach, expect, it, vi } from "vitest";

import { dayOf } from "@bibliothecadao/eternum/expeditions";

import { handleLordsPrice, marketLordsPrice, readShopCalendar, refreshLordsPrice } from "./lords-price";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

/** The LORDS price as the shop quotes it, in D1 with the production migrations. Times are seconds. */
const DAY = 1_800_000_000;
const MORNING = DAY + 600;
const NEXT_DAY = DAY + 7_200 * 3;
const CHAIN = "0x1";

const databases: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const database of databases.splice(0)) await database.close();
  vi.restoreAllMocks();
});

const migrated = async () => {
  const database = createTestD1();
  databases.push(database);
  await database.db.batch(migrationStatements().map((sql) => database.db.prepare(sql)));
  return database.db;
};

const dayOfGame = (gameId: number, dayStart: number) => ({ chainId: CHAIN, gameId, dayStart });
const running = (...days: ReturnType<typeof dayOfGame>[]) => ({ days, readChains: [CHAIN] });
const quote = async (db: D1Database, query = "") => {
  const response = await handleLordsPrice(db, new URL(`https://realms.test/api/shop/price${query}`));
  return [response.status, await response.json()];
};

it("prices each game's day once, at its start, and keeps it", async () => {
  const db = await migrated();
  const read = vi.fn(async () => 0.003637);
  expect(await refreshLordsPrice(db, read, MORNING, running(dayOfGame(1, DAY)))).toBe("read");
  expect(await refreshLordsPrice(db, read, MORNING + 3_600, running(dayOfGame(1, DAY)))).toBe("held");
  expect(read).toHaveBeenCalledTimes(1);
  expect(await quote(db, `?chain=${CHAIN}&game=1`)).toEqual([200, { usd: 0.003637, dayStart: DAY, readAt: MORNING }]);
});

it("never reprices a player's day when another game's day opens", async () => {
  const db = await migrated();
  const a = dayOfGame(1, DAY);
  const b = dayOfGame(2, DAY + 7_200);
  await refreshLordsPrice(db, async () => 0.003637, MORNING, running(a));
  // Game 2's day opens while game 1 stays in the same day, and the market has moved.
  expect(await refreshLordsPrice(db, async () => 0.004, DAY + 7_200, running(a, b))).toBe("read");
  expect(await quote(db, `?chain=${CHAIN}&game=1`)).toEqual([200, { usd: 0.003637, dayStart: DAY, readAt: MORNING }]);
  expect(await quote(db, `?chain=${CHAIN}&game=2`)).toEqual([
    200,
    { usd: 0.004, dayStart: DAY + 7_200, readAt: DAY + 7_200 },
  ]);
  // Game 1's own next day reprices it.
  const next = dayOfGame(1, NEXT_DAY);
  await refreshLordsPrice(db, async () => 0.0045, NEXT_DAY + 600, running(next, b));
  expect((await quote(db, `?chain=${CHAIN}&game=1`))[1]).toEqual({
    usd: 0.0045,
    dayStart: NEXT_DAY,
    readAt: NEXT_DAY + 600,
  });
  expect((await quote(db, `?chain=${CHAIN}&game=2`))[1]).toMatchObject({ usd: 0.004 });
});

it("quotes nothing outside a running game, and refuses a malformed game", async () => {
  const db = await migrated();
  const none = [404, { error: "no_shop_outside_a_frontier_game" }];
  expect(await quote(db, `?chain=${CHAIN}&game=1`)).toEqual(none);
  await refreshLordsPrice(db, async () => 0.003637, MORNING, running(dayOfGame(1, DAY)));
  expect(await quote(db)).toEqual(none);
  expect(await quote(db, `?chain=${CHAIN}&game=9`)).toEqual(none);
  expect((await quote(db, `?chain=${CHAIN}&game=zero`))[0]).toBe(400);
  expect((await quote(db, "?game=1"))[0]).toBe(400);
});

it("takes a game's price away when its shard lists it no longer, and keeps it while the shard cannot be read", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await refreshLordsPrice(db, async () => 0.003637, MORNING, running(dayOfGame(1, DAY)));
  await refreshLordsPrice(db, async () => 0.003637, MORNING, { days: [], readChains: [] });
  expect((await quote(db, `?chain=${CHAIN}&game=1`))[0]).toBe(200);
  await refreshLordsPrice(db, async () => 0.003637, MORNING, { days: [], readChains: [CHAIN] });
  expect((await quote(db, `?chain=${CHAIN}&game=1`))[0]).toBe(404);
});

it("keeps a game's last price when its next day's read fails, or is not a positive number", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await refreshLordsPrice(db, async () => 0.003637, MORNING, running(dayOfGame(1, DAY)));
  const tomorrow = NEXT_DAY + 600;
  const next = running(dayOfGame(1, NEXT_DAY));
  expect(await refreshLordsPrice(db, () => Promise.reject(new Error("CoinGecko: 429")), tomorrow, next)).toBe("kept");
  expect(await refreshLordsPrice(db, async () => 0, tomorrow, next)).toBe("kept");
  expect((await quote(db, `?chain=${CHAIN}&game=1`))[1]).toEqual({ usd: 0.003637, dayStart: DAY, readAt: MORNING });
  // A later read the same day takes over, and is the one the shop quotes.
  expect(await refreshLordsPrice(db, async () => 0.004, tomorrow, next)).toBe("read");
  expect((await quote(db, `?chain=${CHAIN}&game=1`))[1]).toMatchObject({ usd: 0.004, dayStart: NEXT_DAY });
});

it("tries an unanswered day again every ten minutes, not every minute", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await refreshLordsPrice(db, async () => 0.003637, MORNING, running(dayOfGame(1, DAY)));
  const read = vi.fn(() => Promise.reject(new Error("down")));
  const next = running(dayOfGame(1, NEXT_DAY));
  expect(await refreshLordsPrice(db, read, NEXT_DAY + 60, next)).toBe("waiting");
  expect(await refreshLordsPrice(db, read, NEXT_DAY + 600, next)).toBe("kept");
  expect(read).toHaveBeenCalledTimes(1);
});

it("reads the market's price and refuses an answer that is not one", async () => {
  const answer = (body: unknown, status = 200) => (async () => Response.json(body, { status })) as typeof fetch;
  expect(await marketLordsPrice(answer({ lords: { usd: 0.0036 } }))()).toBe(0.0036);
  await expect(marketLordsPrice(answer({ lords: { usd: 0 } }))()).rejects.toThrow("no LORDS price");
  await expect(marketLordsPrice(answer({}, 429))()).rejects.toThrow("429");
});

const UNIT = 7_200;
const START = 1_900_000_000;
const calendar = {
  seed: 0x5eedn,
  startMainAt: START,
  scheduledEndAt: START + 40 * UNIT,
  endAt: START + 40 * UNIT,
  dayUnitSeconds: UNIT,
};
const gameOf = (id: number, status = "Live", startMainAt = START) => ({
  game_id: id,
  mode: "frontier",
  status,
  clock: { start_main_at: startMainAt, scheduled_end_at: calendar.scheduledEndAt, end_at: calendar.endAt },
  expedition: { seed: calendar.seed.toString(), day_unit_seconds: UNIT },
});
const shardServing = (games: unknown[]) => (async () => Response.json({ chain: CHAIN, games })) as typeof fetch;
const withShard = async () => {
  const db = await migrated();
  await db
    .prepare(
      `INSERT INTO "shards" ("url", "chainId", "status", "addedAt") VALUES ('https://shard.test', '${CHAIN}', 'active', 1)`,
    )
    .run();
  return db;
};

it("reads each running game's own current day, so the price changes at the start of a game day, not at midnight UTC", async () => {
  const db = await withShard();
  const first = dayOf(calendar, START)!;
  const second = dayOf(calendar, START + UNIT * 8)!;
  expect(second.start).toBeGreaterThan(first.start);
  const served = shardServing([gameOf(1)]);
  expect(await readShopCalendar(db, first.start + 10, served)).toMatchObject({ days: [dayOfGame(1, first.start)] });
  expect(await readShopCalendar(db, second.start - 1, served)).toMatchObject({ days: [dayOfGame(1, first.start)] });
  expect(await readShopCalendar(db, second.start, served)).toMatchObject({ days: [dayOfGame(1, second.start)] });
});

it("reads games on different calendars each in their own day and ignores an ended game", async () => {
  const db = await withShard();
  const now = START + UNIT * 4;
  const lateStart = START + UNIT;
  const { days } = await readShopCalendar(
    db,
    now,
    shardServing([gameOf(1), gameOf(2, "Live", lateStart), gameOf(3, "Ended")]),
  );
  expect(days).toEqual([
    dayOfGame(1, dayOf(calendar, now)!.start),
    dayOfGame(2, dayOf({ ...calendar, startMainAt: lateStart }, now)!.start),
  ]);
});

it("serves a running game's held price through a shard outage and writes nothing for it", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await withShard();
  const day = dayOf(calendar, START)!;
  const up = shardServing([gameOf(1)]);
  await refreshLordsPrice(db, async () => 0.003637, day.start + 60, await readShopCalendar(db, day.start + 60, up));
  const held = { usd: 0.003637, dayStart: day.start, readAt: day.start + 60 };
  const down = (async () => new Response("no", { status: 502 })) as typeof fetch;
  const unread = await readShopCalendar(db, day.start + 3_600, down);
  expect(unread).toEqual({ days: [], readChains: [] });
  expect(error).toHaveBeenCalled();
  // The market answers while the shard cannot: no price is written, in UTC or otherwise.
  const market = vi.fn(async () => 0.01);
  expect(await refreshLordsPrice(db, market, day.start + 3_600, unread)).toBe("held");
  expect(market).not.toHaveBeenCalled();
  expect(await quote(db, `?chain=${CHAIN}&game=1`)).toEqual([200, held]);
  // The shard recovers inside the same game day: that day's price still stands.
  expect(
    await refreshLordsPrice(db, market, day.start + 4_000, await readShopCalendar(db, day.start + 4_000, up)),
  ).toBe("held");
  expect(await quote(db, `?chain=${CHAIN}&game=1`)).toEqual([200, held]);
});
