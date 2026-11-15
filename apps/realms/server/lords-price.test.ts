import { afterEach, expect, it, vi } from "vitest";

import { handleLordsPrice, latestLordsPrice, marketLordsPrice, refreshLordsPrice } from "./lords-price";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

/** The day's LORDS price as the shop quotes it, in D1 with the production migrations. */
const DAY = 20_000;
const MORNING = DAY * 86_400 + 600;

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
  expect(await refreshLordsPrice(db, read, MORNING)).toBe("read");
  expect(await refreshLordsPrice(db, read, MORNING + 3_600)).toBe("held");
  expect(read).toHaveBeenCalledTimes(1);
  expect(await latestLordsPrice(db)).toEqual({ usd: 0.003637, day: DAY, readAt: MORNING });
});

it("keeps the last price when the next day's read fails, or is not a positive number", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await refreshLordsPrice(db, async () => 0.003637, MORNING);
  const tomorrow = MORNING + 86_400;
  expect(await refreshLordsPrice(db, () => Promise.reject(new Error("CoinGecko: 429")), tomorrow)).toBe("kept");
  expect(await refreshLordsPrice(db, async () => 0, tomorrow)).toBe("kept");
  expect(await latestLordsPrice(db)).toEqual({ usd: 0.003637, day: DAY, readAt: MORNING });
  // A later read the same day takes over, and is the one the shop quotes.
  expect(await refreshLordsPrice(db, async () => 0.004, tomorrow)).toBe("read");
  expect((await latestLordsPrice(db))?.usd).toBe(0.004);
});

it("tries an unanswered day again every ten minutes, not every minute", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await refreshLordsPrice(db, async () => 0.003637, MORNING);
  const read = vi.fn(() => Promise.reject(new Error("down")));
  const tomorrow = (DAY + 1) * 86_400;
  expect(await refreshLordsPrice(db, read, tomorrow + 60)).toBe("waiting");
  expect(await refreshLordsPrice(db, read, tomorrow + 600)).toBe("kept");
  expect(read).toHaveBeenCalledTimes(1);
});

it("serves the price, and says so when none has been read rather than making one up", async () => {
  const db = await migrated();
  const none = await handleLordsPrice(db);
  expect([none.status, await none.json()]).toEqual([503, { error: "lords_price_unavailable" }]);
  await refreshLordsPrice(db, async () => 0.003637, MORNING);
  const served = await handleLordsPrice(db);
  expect([served.status, await served.json()]).toEqual([200, { usd: 0.003637, day: DAY, readAt: MORNING }]);
});

it("reads the market's price and refuses an answer that is not one", async () => {
  const answer = (body: unknown, status = 200) => (async () => Response.json(body, { status })) as typeof fetch;
  expect(await marketLordsPrice(answer({ lords: { usd: 0.0036 } }))()).toBe(0.0036);
  await expect(marketLordsPrice(answer({ lords: { usd: 0 } }))()).rejects.toThrow("no LORDS price");
  await expect(marketLordsPrice(answer({}, 429))()).rejects.toThrow("429");
});
