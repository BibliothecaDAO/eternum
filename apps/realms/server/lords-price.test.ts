import { afterEach, expect, it, vi } from "vitest";

import { dayOf } from "@bibliothecadao/eternum/expeditions";

import { handleLordsPrice, marketLordsPrice, readPriceDay, refreshLordsPrice } from "./lords-price";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

/** The one LORDS price as the shop quotes it, in D1 with the production migrations. Times are seconds. */
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

const quote = async (db: D1Database) => {
  const response = await handleLordsPrice(db);
  return [response.status, await response.json()];
};
const down = () => Promise.reject(new Error("CoinGecko: 429"));

it("prices a day by its first successful read and keeps it, and quotes it", async () => {
  const db = await migrated();
  const read = vi.fn(async () => 0.003637);
  expect(await refreshLordsPrice(db, read, MORNING, DAY)).toBe("read");
  expect(await refreshLordsPrice(db, read, MORNING + 3_600, DAY)).toBe("held");
  expect(read).toHaveBeenCalledTimes(1);
  const quoted = [200, { usd: 0.003637, dayStart: DAY, readAt: MORNING }];
  expect(await quote(db)).toEqual(quoted);
});

it("quotes only the current day: until a new day's read succeeds the shop says so, never yesterday's", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await refreshLordsPrice(db, async () => 0.003637, MORNING, DAY);
  expect(await refreshLordsPrice(db, down, NEXT_DAY + 60, NEXT_DAY)).toBe("kept");
  expect(await refreshLordsPrice(db, async () => 0, NEXT_DAY + 120, NEXT_DAY)).toBe("kept");
  expect(await quote(db)).toEqual([503, { error: "price_not_read_yet", dayStart: NEXT_DAY }]);
});

it("reads a new day on every run from its opening until a read succeeds, and keeps the first one that does", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await refreshLordsPrice(db, async () => 0.003637, MORNING, DAY);
  // The day opens at an instant off any ten-minute boundary: the very next run reads, and each failure is retried.
  const opens = NEXT_DAY + 61;
  const failing = vi.fn(down);
  expect(await refreshLordsPrice(db, failing, opens, NEXT_DAY)).toBe("kept");
  expect(await refreshLordsPrice(db, failing, opens + 60, NEXT_DAY)).toBe("kept");
  expect(failing).toHaveBeenCalledTimes(2);
  expect(await refreshLordsPrice(db, async () => 0.004, opens + 120, NEXT_DAY)).toBe("read");
  expect(await refreshLordsPrice(db, async () => 0.005, opens + 180, NEXT_DAY)).toBe("held");
  expect(await quote(db)).toEqual([200, { usd: 0.004, dayStart: NEXT_DAY, readAt: opens + 120 }]);
});

it("keeps the price day it had while the calendar cannot be read, and opens none for an unknown day", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  const market = vi.fn(async () => 0.01);
  expect(await refreshLordsPrice(db, market, MORNING, null)).toBe("held");
  expect(market).not.toHaveBeenCalled();
  expect(await quote(db)).toEqual([503, { error: "price_not_read_yet", dayStart: null }]);
  await refreshLordsPrice(db, async () => 0.003637, MORNING, DAY);
  expect(await refreshLordsPrice(db, market, MORNING + 3_600, null)).toBe("held");
  expect(market).not.toHaveBeenCalled();
  expect((await quote(db))[1]).toMatchObject({ usd: 0.003637, dayStart: DAY });
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
const withShards = async (...chains: string[]) => {
  const db = await migrated();
  for (const chain of chains)
    await db
      .prepare(
        `INSERT INTO "shards" ("url", "chainId", "status", "addedAt") VALUES ('https://shard${chain}.test', ?, 'active', 1)`,
      )
      .bind(chain)
      .run();
  return db;
};
const servingByShard = (games: Record<string, unknown[]>) =>
  (async (url) => {
    const chain = Object.keys(games).find((name) => String(url).startsWith(`https://shard${name}.test`));
    return chain ? Response.json({ chain, games: games[chain] }) : new Response("no", { status: 502 });
  }) as typeof fetch;

const UTC_DAY = Math.floor((START + UNIT * 4) / 86_400) * 86_400;

it("sets the price day by the Frontier game's own day, so it changes at the start of a game day, not at midnight UTC", async () => {
  const db = await withShards(CHAIN);
  const first = dayOf(calendar, START)!;
  const second = dayOf(calendar, START + UNIT * 8)!;
  expect(second.start).toBeGreaterThan(first.start);
  const served = servingByShard({ [CHAIN]: [gameOf(1)] });
  expect(await readPriceDay(db, first.start + 10, served)).toBe(first.start);
  expect(await readPriceDay(db, second.start - 1, served)).toBe(first.start);
  expect(await readPriceDay(db, second.start, served)).toBe(second.start);
});

it("takes one calendar for every game: the running Frontier game with the lowest id, whatever the others' days", async () => {
  const db = await withShards(CHAIN, "0x2");
  const now = START + UNIT * 4;
  const lateStart = START + UNIT;
  const served = servingByShard({
    [CHAIN]: [gameOf(5), gameOf(2, "Live", lateStart), gameOf(1, "Ended")],
    "0x2": [gameOf(3)],
  });
  const lowest = dayOf({ ...calendar, startMainAt: lateStart }, now)!.start;
  expect(lowest).not.toBe(dayOf(calendar, now)!.start);
  expect(await readPriceDay(db, now, served)).toBe(lowest);
  // The same game answers on every read, and an ended game does not take the day.
  expect(await readPriceDay(db, now + 1, served)).toBe(lowest);
});

it("falls back to the UTC day when no Frontier game runs, and holds the day while any listed shard cannot be read", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const now = START + UNIT * 4;
  expect(await readPriceDay(await withShards(), now)).toBe(UTC_DAY);
  const db = await withShards(CHAIN, "0x2");
  expect(await readPriceDay(db, now, servingByShard({ [CHAIN]: [gameOf(1, "Ended")], "0x2": [] }))).toBe(UTC_DAY);
  // One shard down: the day is unknown, not "no game runs", so no UTC day replaces the Frontier one.
  expect(await readPriceDay(db, now, servingByShard({ [CHAIN]: [gameOf(1)] }))).toBeNull();
  expect(error).toHaveBeenCalled();
});
