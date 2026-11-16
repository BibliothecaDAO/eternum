import { afterEach, expect, it, vi } from "vitest";

import { dayOf } from "@bibliothecadao/eternum/expeditions";

import { handleLordsPrice, latestLordsPrice, marketLordsPrice, priceDayStart, refreshLordsPrice } from "./lords-price";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

/** The game day's LORDS price as the shop quotes it, in D1 with the production migrations. Times are seconds. */
const DAY = 1_800_000_000;
const MORNING = DAY + 600;
const NEXT_DAY = DAY + 7_200 * 3;

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

it("reads the price once a day and keeps it", async () => {
  const db = await migrated();
  const read = vi.fn(async () => 0.003637);
  expect(await refreshLordsPrice(db, read, MORNING, DAY)).toBe("read");
  expect(await refreshLordsPrice(db, read, MORNING + 3_600, DAY)).toBe("held");
  expect(read).toHaveBeenCalledTimes(1);
  expect(await latestLordsPrice(db)).toEqual({ usd: 0.003637, dayStart: DAY, readAt: MORNING });
});

it("keeps the last price when the next day's read fails, or is not a positive number", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await refreshLordsPrice(db, async () => 0.003637, MORNING, DAY);
  const tomorrow = NEXT_DAY + 600;
  expect(await refreshLordsPrice(db, () => Promise.reject(new Error("CoinGecko: 429")), tomorrow, NEXT_DAY)).toBe(
    "kept",
  );
  expect(await refreshLordsPrice(db, async () => 0, tomorrow, NEXT_DAY)).toBe("kept");
  expect(await latestLordsPrice(db)).toEqual({ usd: 0.003637, dayStart: DAY, readAt: MORNING });
  // A later read the same day takes over, and is the one the shop quotes.
  expect(await refreshLordsPrice(db, async () => 0.004, tomorrow, NEXT_DAY)).toBe("read");
  expect((await latestLordsPrice(db))?.usd).toBe(0.004);
});

it("tries an unanswered day again every ten minutes, not every minute", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await refreshLordsPrice(db, async () => 0.003637, MORNING, DAY);
  const read = vi.fn(() => Promise.reject(new Error("down")));
  const tomorrow = NEXT_DAY;
  expect(await refreshLordsPrice(db, read, tomorrow + 60, NEXT_DAY)).toBe("waiting");
  expect(await refreshLordsPrice(db, read, tomorrow + 600, NEXT_DAY)).toBe("kept");
  expect(read).toHaveBeenCalledTimes(1);
});

it("serves the price, and says so when none has been read rather than making one up", async () => {
  const db = await migrated();
  const none = await handleLordsPrice(db);
  expect([none.status, await none.json()]).toEqual([503, { error: "lords_price_unavailable" }]);
  await refreshLordsPrice(db, async () => 0.003637, MORNING, DAY);
  const served = await handleLordsPrice(db);
  expect([served.status, await served.json()]).toEqual([200, { usd: 0.003637, dayStart: DAY, readAt: MORNING }]);
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
const gameOf = (id: number, status = "Live") => ({
  game_id: id,
  mode: "frontier",
  status,
  clock: { start_main_at: START, scheduled_end_at: calendar.scheduledEndAt, end_at: calendar.endAt },
  expedition: { seed: calendar.seed.toString(), day_unit_seconds: UNIT },
});
const shardServing = (games: unknown[]) => (async () => Response.json({ chain: "0x1", games })) as typeof fetch;

it("changes the price at the start of each game day, not at midnight UTC", async () => {
  const db = await migrated();
  await db
    .prepare(
      `INSERT INTO "shards" ("url", "chainId", "status", "addedAt") VALUES ('https://shard.test', '0x1', 'active', 1)`,
    )
    .run();
  const second = dayOf(calendar, START + UNIT * 8)!;
  const first = dayOf(calendar, START)!;
  expect(second.start).toBeGreaterThan(first.start);
  const served = shardServing([gameOf(1)]);
  expect(await priceDayStart(db, first.start + 10, served)).toBe(first.start);
  expect(await priceDayStart(db, second.start - 1, served)).toBe(first.start);
  expect(await priceDayStart(db, second.start, served)).toBe(second.start);
});

it("follows the latest day opened when games on one shard run different days, ignores an ended game, and falls back to the UTC day with none running", async () => {
  const db = await migrated();
  await db
    .prepare(
      `INSERT INTO "shards" ("url", "chainId", "status", "addedAt") VALUES ('https://shard.test', '0x1', 'active', 1)`,
    )
    .run();
  const late = { ...gameOf(2), clock: { ...gameOf(2).clock, start_main_at: START + UNIT, end_at: calendar.endAt } };
  const now = START + UNIT * 4;
  const lateStart = dayOf({ ...calendar, startMainAt: START + UNIT }, now)!.start;
  const firstStart = dayOf(calendar, now)!.start;
  expect(await priceDayStart(db, now, shardServing([gameOf(1), late]))).toBe(Math.max(lateStart, firstStart));
  expect(await priceDayStart(db, now, shardServing([gameOf(1, "Ended")]))).toBe(Math.floor(now / 86_400) * 86_400);
});

it("counts a shard that cannot be read for nothing and says so", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await db
    .prepare(
      `INSERT INTO "shards" ("url", "chainId", "status", "addedAt") VALUES ('https://shard.test', '0x1', 'active', 1)`,
    )
    .run();
  const down = (async () => new Response("no", { status: 502 })) as typeof fetch;
  expect(await priceDayStart(db, START + 5, down)).toBe(Math.floor((START + 5) / 86_400) * 86_400);
  expect(error).toHaveBeenCalled();
});
