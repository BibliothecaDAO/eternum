import { afterEach, expect, it, vi } from "vitest";

import { dayOf } from "@bibliothecadao/eternum/expeditions";

import type { IdentityAuth } from "./auth";
import { handleLordsPrice, marketLordsPrice, readPriceDay, refreshLordsPrice, type PriceDay } from "./lords-price";
import type { ShopAccess } from "./shop-game";
import { createTestD1 } from "./test-d1";
import { migrationStatements } from "./workerd-harness";

/** The one LORDS price as the shop quotes it, in D1 with the production migrations. Times are seconds. */
const DAY = 1_800_000_000;
const DAY_LENGTH = 7_200 * 3;
const MORNING = DAY + 600;
const NEXT_DAY = DAY + DAY_LENGTH;
const CHAIN = "0x1";
const dayAt = (start: number, calendar = "utc"): PriceDay => ({ calendar, start, end: start + DAY_LENGTH });

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

const signedIn = (realmsId: string | null) =>
  ({ api: { getSession: async () => (realmsId ? { user: { realmsId } } : null) } }) as unknown as IdentityAuth;
const plays: ShopAccess = async () => true;
/** The quote at `now`: the one clock the route reads. */
const quote = async (
  db: D1Database,
  now: number,
  access: ShopAccess = plays,
  query = `?chain=${CHAIN}&game=1`,
  realmsId: string | null = "0xa1",
) => {
  const response = await handleLordsPrice(
    new Request(`https://realms.test/api/shop/price${query}`),
    signedIn(realmsId),
    { db, access, now: () => now },
  );
  return [response.status, await response.json()];
};
const refresh = (
  db: D1Database,
  read: () => Promise<number>,
  now: number,
  calendar: PriceDay | null | (() => Promise<PriceDay | null>),
) => refreshLordsPrice(db, read, now, typeof calendar === "function" ? calendar : async () => calendar);
const rows = async (db: D1Database) =>
  (await db.prepare('SELECT "day_start", "usd" FROM "lords_price" ORDER BY "day_start"').all()).results;
const NO_PRICE = [503, { error: "no_price_now" }];
const down = () => Promise.reject(new Error("CoinGecko: 429"));

it("prices a day by its first successful read and keeps it, quoting the same price to every player", async () => {
  const db = await migrated();
  const read = vi.fn(async () => 0.003637);
  expect(await refresh(db, read, MORNING, dayAt(DAY))).toBe("read");
  expect(await refresh(db, read, MORNING + 3_600, dayAt(DAY))).toBe("held");
  expect(read).toHaveBeenCalledTimes(1);
  const quoted = [200, { usd: 0.003637, dayStart: DAY, dayEnd: NEXT_DAY, readAt: MORNING }];
  expect(await quote(db, MORNING + 5)).toEqual(quoted);
  expect(await quote(db, MORNING + 5, plays, `?chain=0x2&game=7`, "0xb2")).toEqual(quoted);
});

it("says there is no price now once the priced day has ended and the next is not priced, never the old price", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await refresh(db, async () => 0.003637, MORNING, dayAt(DAY));
  expect(await quote(db, NEXT_DAY - 1)).toMatchObject([200, { usd: 0.003637 }]);
  expect(await quote(db, NEXT_DAY)).toEqual(NO_PRICE);
  expect(await refresh(db, down, NEXT_DAY + 60, dayAt(NEXT_DAY))).toBe("kept");
  expect(await refresh(db, async () => 0, NEXT_DAY + 120, dayAt(NEXT_DAY))).toBe("kept");
  expect(await quote(db, NEXT_DAY + 130)).toEqual(NO_PRICE);
});

it("reads a new day on every run from its opening until a read succeeds, keeps the first one that does, and says when it was read", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await refresh(db, async () => 0.003637, MORNING, dayAt(DAY));
  const opens = NEXT_DAY + 61;
  const failing = vi.fn(down);
  expect(await refresh(db, failing, opens, dayAt(NEXT_DAY))).toBe("kept");
  expect(await refresh(db, failing, opens + 60, dayAt(NEXT_DAY))).toBe("kept");
  expect(failing).toHaveBeenCalledTimes(2);
  expect(await refresh(db, async () => 0.004, opens + 120, dayAt(NEXT_DAY))).toBe("read");
  expect(await refresh(db, async () => 0.005, opens + 180, dayAt(NEXT_DAY))).toBe("held");
  expect(await quote(db, opens + 200)).toEqual([
    200,
    { usd: 0.004, dayStart: NEXT_DAY, dayEnd: NEXT_DAY + DAY_LENGTH, readAt: opens + 120 },
  ]);
});

it("opens no day while the calendar cannot be read: the day that ended is not quoted again", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  const market = vi.fn(async () => 0.01);
  expect(await refresh(db, market, MORNING, null)).toBe("held");
  expect(market).not.toHaveBeenCalled();
  expect(await quote(db, MORNING)).toEqual(NO_PRICE);
  await refresh(db, async () => 0.003637, MORNING, dayAt(DAY));
  expect(await refresh(db, market, NEXT_DAY + 3_600, null)).toBe("held");
  expect(market).not.toHaveBeenCalled();
  expect(await quote(db, NEXT_DAY + 3_600)).toEqual(NO_PRICE);
  expect(await rows(db)).toEqual([{ day_start: DAY, usd: 0.003637 }]);
});

it("opens one day when two refreshes both saw no day, and no reader sees the price change between them", async () => {
  const db = await migrated();
  const both = bothReadFirst(db);
  const published: unknown[] = [];
  const run = (usd: number) =>
    refresh(both, async () => usd, MORNING, dayAt(DAY)).then(async () => published.push(await quote(db, MORNING)));
  await Promise.all([run(0.004), run(0.005)]);
  expect(await rows(db)).toHaveLength(1);
  expect(published[0]).toEqual(published[1]);
  expect(published[0]).toMatchObject([200, { dayStart: DAY }]);
});

it("does not let an old refresh, delayed past a boundary, move the day back", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await refresh(db, async () => 0.004, NEXT_DAY + 5, dayAt(NEXT_DAY));
  expect(await refresh(db, async () => 0.009, NEXT_DAY - 30, dayAt(DAY))).toBe("held");
  expect(await rows(db)).toEqual([{ day_start: NEXT_DAY, usd: 0.004 }]);
  expect(await quote(db, NEXT_DAY + 10)).toMatchObject([200, { usd: 0.004, dayStart: NEXT_DAY }]);
});

it("keeps the calendar that opened the day until the day ends, whatever the running set does, and hands over at the boundary", async () => {
  const db = await migrated();
  await refresh(db, async () => 0.004, MORNING, dayAt(DAY, "0x1:7"));
  // A game starts on another shard, takes the lowest id, then ends again: the day neither reprices nor reads a calendar.
  const other = vi.fn(async () => dayAt(DAY + 100, "0x2:1"));
  const market = vi.fn(async () => 0.009);
  expect(await refresh(db, market, MORNING + 60, other)).toBe("held");
  expect(await refresh(db, market, NEXT_DAY - 1, other)).toBe("held");
  expect(other).not.toHaveBeenCalled();
  expect(market).not.toHaveBeenCalled();
  expect(await quote(db, NEXT_DAY - 1)).toMatchObject([200, { usd: 0.004, dayStart: DAY }]);
  expect(await refresh(db, async () => 0.006, NEXT_DAY, other)).toBe("read");
  expect(other).toHaveBeenCalledTimes(1);
  expect(await quote(db, NEXT_DAY + 1)).toMatchObject([200, { usd: 0.006, dayStart: DAY + 100 }]);
});

it("quotes no price after a day ends while one shard is down and another stays healthy, and prices the day it reopens", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await withShards(CHAIN, "0x2");
  const dayEnd = dayOf(calendar, START)!.end;
  const healthy = { [CHAIN]: [gameOf(1)] };
  const reading = (now: number, shards: Record<string, unknown[]>) => () =>
    readPriceDay(db, now, servingByShard(shards));
  const both = { ...healthy, "0x2": [] };
  await refresh(db, async () => 0.004, START + 60, reading(START + 60, both));
  expect(await quote(db, dayEnd - 1)).toMatchObject([200, { usd: 0.004 }]);
  // The next boundary passes with "0x2" unreadable: the healthy shard's players are quoted nothing.
  for (const now of [dayEnd, dayEnd + 600, dayEnd + 3_600]) {
    expect(await refresh(db, async () => 0.009, now, reading(now, healthy))).toBe("held");
    expect(await quote(db, now)).toEqual(NO_PRICE);
  }
  const recovered = dayEnd + 7_000;
  expect(await refresh(db, async () => 0.006, recovered, reading(recovered, both))).toBe("read");
  expect(await quote(db, recovered)).toMatchObject([200, { usd: 0.006, dayStart: dayEnd, readAt: recovered }]);
});

it("gives the shop only to a signed-in player of a running Frontier game, and says so when its shard cannot", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const db = await migrated();
  await refresh(db, async () => 0.003637, MORNING, dayAt(DAY));
  const at = MORNING + 5;
  expect(await quote(db, at, plays, undefined, null)).toEqual([401, { error: "unauthorized" }]);
  expect(await quote(db, at, async () => false)).toEqual([404, { error: "no_shop_outside_a_frontier_game" }]);
  expect(await quote(db, at, plays, "")).toEqual([400, { error: "invalid_game" }]);
  expect((await quote(db, at, plays, `?chain=${CHAIN}&game=zero`))[0]).toBe(400);
  expect((await quote(db, at, plays, "?game=1"))[0]).toBe(400);
  const unreadable: ShopAccess = () => Promise.reject(new Error("shard down"));
  expect(await quote(db, at, unreadable)).toEqual([503, { error: "shop_unavailable" }]);
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

/**
 * The database as two concurrent refreshes see it: each one's first read of the price table waits until both have read,
 * so neither has written when the other reads.
 */
const bothReadFirst = (db: D1Database): D1Database => {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const gated = (statement: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(statement, {
      get: (target, property) => {
        if (property === "bind") return (...values: unknown[]) => gated(target.bind(...values));
        if (property !== "first") return Reflect.get(target, property).bind(target);
        return async (...args: unknown[]) => {
          const row = await (target.first as (...a: unknown[]) => Promise<unknown>)(...args);
          if (arrived < 2) {
            arrived += 1;
            if (arrived === 2) release();
            await gate;
          }
          return row;
        };
      },
    });
  return new Proxy(db, {
    get: (target, property) => {
      if (property !== "prepare") return Reflect.get(target, property).bind(target);
      return (sql: string) => {
        const statement = target.prepare(sql);
        return /^\s*select/i.test(sql) && sql.includes("lords_price") ? gated(statement) : statement;
      };
    },
  });
};

const UTC_DAY = Math.floor((START + UNIT * 4) / 86_400) * 86_400;

it("sets the price day by the Frontier game's own day, so it changes at the start of a game day, not at midnight UTC", async () => {
  const db = await withShards(CHAIN);
  const first = dayOf(calendar, START)!;
  const second = dayOf(calendar, START + UNIT * 8)!;
  expect(second.start).toBeGreaterThan(first.start);
  const served = servingByShard({ [CHAIN]: [gameOf(1)] });
  const expected = (day: typeof first) => ({ calendar: `${CHAIN}:1`, start: day.start, end: day.end });
  expect(await readPriceDay(db, first.start + 10, served)).toEqual(expected(first));
  expect(await readPriceDay(db, second.start - 1, served)).toEqual(expected(first));
  expect(await readPriceDay(db, second.start, served)).toEqual(expected(second));
});

it("takes one calendar for every game: the running Frontier game with the lowest id, whatever the others' days", async () => {
  const db = await withShards(CHAIN, "0x2");
  const now = START + UNIT * 4;
  const lateStart = START + UNIT;
  const served = servingByShard({
    [CHAIN]: [gameOf(5), gameOf(2, "Live", lateStart), gameOf(1, "Ended")],
    "0x2": [gameOf(3)],
  });
  const lowest = dayOf({ ...calendar, startMainAt: lateStart }, now)!;
  expect(lowest.start).not.toBe(dayOf(calendar, now)!.start);
  const expected = { calendar: `${CHAIN}:2`, start: lowest.start, end: lowest.end };
  expect(await readPriceDay(db, now, served)).toEqual(expected);
  // The same game answers on every read, and an ended game does not take the day.
  expect(await readPriceDay(db, now + 1, served)).toEqual(expected);
});

it("falls back to the UTC day when no Frontier game runs, and answers none while any listed shard cannot be read", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const now = START + UNIT * 4;
  const utc = { calendar: "utc", start: UTC_DAY, end: UTC_DAY + 86_400 };
  expect(await readPriceDay(await withShards(), now)).toEqual(utc);
  const db = await withShards(CHAIN, "0x2");
  expect(await readPriceDay(db, now, servingByShard({ [CHAIN]: [gameOf(1, "Ended")], "0x2": [] }))).toEqual(utc);
  // One shard down: the day is unknown, not "no game runs", so no UTC day replaces the Frontier one.
  expect(await readPriceDay(db, now, servingByShard({ [CHAIN]: [gameOf(1)] }))).toBeNull();
  expect(error).toHaveBeenCalled();
});
