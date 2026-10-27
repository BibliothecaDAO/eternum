import { readFileSync } from "node:fs";
import { Effect } from "effect";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { D1CalendarStore } from "./calendar-store";
import { createCalendarRoutes } from "./calendar-routes";
import { frontierSeasonRequest } from "./schemas";
import { runLaunchSchedule, scheduleFrontierSeason } from "./schedule";
import { D1LaunchStore } from "./store";
import { toFactoryRunRecord } from "./model";
import { createLaunchTestDatabase, testChain } from "./test-database";
import type { FrontierSeasonPhase } from "./calendar";
import type { SlotStore } from "./slots";

let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.close();
});
const devcon: FrontierSeasonPhase = {
  phase: "frontier",
  presetId: 6,
  startsAt: "2026-11-03T06:30:00.000Z",
  endsAt: "2026-11-06T14:30:00.000Z",
};
const normal: FrontierSeasonPhase = {
  phase: "frontier",
  presetId: 5,
  startsAt: "2026-11-08T18:30:00.000Z",
  endsAt: "2026-12-28T18:30:00.000Z",
};
const before = Date.parse(devcon.startsAt) - 1;
const put = (body: unknown, phase = "frontier", now = before) =>
  createCalendarRoutes(new D1CalendarStore(database.db), () => now).request(`/${phase}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test.each([
  [devcon, 288000],
  [normal, 4320000],
] as const)("API to cron preserves preset $0.presetId and its complete season", async (phase, duration) => {
  expect((await put(phase)).status).toBe(200);
  const restarted = new D1CalendarStore(database.db);
  expect(await restarted.list()).toEqual([phase]);
  const launches = new D1LaunchStore(database.db, testChain());
  vi.spyOn(Date, "now").mockReturnValue(Date.parse(phase.startsAt));
  const create = vi.fn();
  const slots = { create } as unknown as SlotStore;
  await Effect.runPromise(runLaunchSchedule(launches, slots, restarted));
  await Effect.runPromise(runLaunchSchedule(launches, slots, restarted));
  const runs = await launches.list("madara.frontier");
  expect(runs).toHaveLength(1);
  expect(runs[0]!.request).toEqual({
    environment: "madara.frontier",
    version: String(phase.presetId),
    gameName: `frontier-${Date.parse(phase.startsAt) / 1000}`,
    gameStartTime: phase.startsAt,
    durationSeconds: duration,
  });
  expect(create).not.toHaveBeenCalled();
});

test.each([undefined, "6", null, 0, -1, 6.5, 999, 1])(
  "refuses missing, malformed, unknown or non-Frontier preset %s",
  async (presetId) => {
    const response = await put({ ...devcon, presetId });
    expect([400, 409]).toContain(response.status);
    expect(await new D1CalendarStore(database.db).list()).toEqual([]);
  },
);

test("uses the selected clock for alignment and complete bags, with no partial 84-hour season", async () => {
  expect((await put({ ...devcon, endsAt: "2026-11-06T18:30:00.000Z" })).status).toBe(409);
  const oneBag = { ...devcon, endsAt: "2026-11-04T09:10:00.000Z" };
  expect((await put(oneBag)).status).toBe(200);
  expect((await put({ ...oneBag, presetId: 5 })).status).toBe(409);
  const shifted = { ...devcon, startsAt: "2026-11-03T06:30:40.000Z", endsAt: "2026-11-06T14:30:40.000Z" };
  expect((await put(shifted)).status).toBe(200);
  expect((await put({ ...shifted, presetId: 5 })).status).toBe(409);
  expect((await put({ ...devcon, startsAt: "2026-11-03T06:30:01.000Z" })).status).toBe(409);
});

test("Blitz keeps dates without a preset and rejects an accidental Frontier preset", async () => {
  const dates = { startsAt: devcon.startsAt, endsAt: devcon.endsAt };
  expect((await put({ ...dates, presetId: 6 }, "blitz")).status).toBe(400);
  expect((await put(dates, "blitz")).status).toBe(200);
  expect(await new D1CalendarStore(database.db).list()).toEqual([{ phase: "blitz", ...dates }]);
});

test("running Frontier cannot change preset; the next season can select normal speed", async () => {
  expect((await put(devcon)).status).toBe(200);
  expect((await put({ ...devcon, presetId: 5 }, "frontier", Date.parse(devcon.startsAt))).status).toBe(409);
  expect(await new D1CalendarStore(database.db).list()).toEqual([devcon]);
  expect((await put(normal, "frontier", Date.parse(devcon.endsAt))).status).toBe(200);
  expect(await new D1CalendarStore(database.db).list()).toEqual([normal]);
});

test("precreation, interrupted launch and cron keep one immutable request, including after a failed retry", async () => {
  await put(devcon);
  const launches = new D1LaunchStore(database.db, testChain());
  const request = frontierSeasonRequest(devcon);
  const first = await launches.enqueue("game", request);
  expect((await put({ ...devcon, presetId: 5 })).status).toBe(409);
  expect((await put({ ...devcon, startsAt: normal.startsAt, endsAt: normal.endsAt })).status).toBe(409);
  expect((await put(devcon)).status).toBe(200);
  expect(await scheduleFrontierSeason(launches, devcon)).toMatchObject({ id: first.id, status: "queued" });
  expect(await launches.delete("game", request.environment, request.gameName)).toBe(false);
  expect(toFactoryRunRecord(first).recovery.canDelete).toBe(false);
  const running = (await launches.startNext(Date.now()))!;
  const restarted = new D1LaunchStore(database.db, testChain());
  expect(await restarted.startNext(Date.now())).toMatchObject({ id: running.id, attempts: 2 });
  await restarted.fail(running.id, "interrupted after create_game");
  await expect(restarted.enqueue("game", { ...request, version: "5" })).rejects.toThrow("another preset");
  await expect(restarted.enqueue("game", { ...request, durationSeconds: 576000 })).rejects.toThrow("another preset");
  expect(await restarted.find("game", request.environment, request.gameName)).toMatchObject({
    id: running.id,
    status: "failed",
    request,
  });
  const continued = await restarted.enqueue("game", request);
  expect(continued).toMatchObject({ status: "queued", request });
  expect(await scheduleFrontierSeason(restarted, devcon)).toMatchObject({ id: continued.id, request });
  expect(await restarted.list("madara.frontier")).toHaveLength(1);
});

test("a stale cron read cannot queue a season after the operator changes its preset", async () => {
  await put(devcon);
  expect((await put({ ...devcon, presetId: 5 })).status).toBe(200);
  const launches = new D1LaunchStore(database.db, testChain());
  await expect(scheduleFrontierSeason(launches, devcon)).rejects.toThrow("published calendar");
  expect(await launches.list("madara.frontier")).toEqual([]);
  expect(await scheduleFrontierSeason(launches, { ...devcon, presetId: 5 })).toMatchObject({
    request: { version: "5" },
  });
});

test("a concurrent calendar edit and precreation agree on one preset", async () => {
  await put(devcon);
  const launches = new D1LaunchStore(database.db, testChain());
  const [edit, launch] = await Promise.allSettled([
    put({ ...devcon, presetId: 5 }),
    scheduleFrontierSeason(launches, devcon),
  ]);
  const phases = await new D1CalendarStore(database.db).list();
  const runs = await launches.list("madara.frontier");
  expect(edit.status).toBe("fulfilled");
  if (launch.status === "fulfilled") {
    expect(edit.status === "fulfilled" && edit.value.status).toBe(409);
    expect(phases).toEqual([devcon]);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.request).toMatchObject({ version: "6" });
  } else {
    expect(edit.status === "fulfilled" && edit.value.status).toBe(200);
    expect(phases).toEqual([{ ...devcon, presetId: 5 }]);
    expect(runs).toEqual([]);
  }
});

test("migration preserves legacy dates and makes their preset explicit without a write default", async () => {
  const db = database.db;
  await db.prepare("DROP TABLE season_phases").run();
  const statements = (file: string) =>
    readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8")
      .replace(/^--.*$/gm, "")
      .split(";")
      .map((sql) => sql.trim())
      .filter(Boolean)
      .map((sql) => db.prepare(sql));
  await db.batch(statements("0004_season_calendar.sql"));
  await db.batch(
    ["frontier", "blitz"].map((phase) =>
      db
        .prepare("INSERT INTO season_phases (phase, starts_at, ends_at, updated_at) VALUES (?, ?, ?, ?)")
        .bind(phase, Date.parse(devcon.startsAt), Date.parse(devcon.endsAt), before),
    ),
  );
  await expect(new D1CalendarStore(db).list()).rejects.toThrow("Frontier calendar has no preset");
  await db.batch(statements("0013_calendar_preset.sql"));
  expect(await new D1CalendarStore(db).list()).toEqual([
    { phase: "blitz", startsAt: devcon.startsAt, endsAt: devcon.endsAt },
    { ...devcon, presetId: 5 },
  ]);
  expect((await db.prepare("SELECT DISTINCT updated_at FROM season_phases").all()).results).toEqual([
    { updated_at: before },
  ]);
  await expect(db.prepare("UPDATE season_phases SET preset_id = NULL WHERE phase = 'frontier'").run()).rejects.toThrow(
    "CHECK constraint failed",
  );
  await expect(db.prepare("UPDATE season_phases SET preset_id = 6 WHERE phase = 'blitz'").run()).rejects.toThrow(
    "CHECK constraint failed",
  );
});

test("the confirmed legacy extension keeps its existing launch and original retry payload", async () => {
  const approved = (await import("../../../config/source/frontier/extension.json")).default;
  const original: FrontierSeasonPhase = {
    phase: "frontier",
    presetId: approved.presetId,
    startsAt: new Date(approved.start * 1000).toISOString(),
    endsAt: new Date(approved.oldEnd * 1000).toISOString(),
  };
  const calendar = new D1CalendarStore(database.db, async () => ({ confirmed: true }));
  await calendar.set(original, approved.start * 1000 - 1);
  const launches = new D1LaunchStore(database.db, testChain());
  const run = await scheduleFrontierSeason(launches, original);
  const extended = { ...original, endsAt: new Date(approved.end * 1000).toISOString() };
  await calendar.set(extended, (approved.oldEnd - 1) * 1000);
  expect(await scheduleFrontierSeason(launches, extended)).toMatchObject({ id: run.id, request: run.request });
  expect(await launches.enqueue("game", run.request)).toMatchObject({ request: run.request });
  expect(await launches.list("madara.frontier")).toHaveLength(1);
});

test("canonical launch requests never fill missing fields from normal-speed defaults", async () => {
  await put({ ...devcon, presetId: 5 });
  const launches = new D1LaunchStore(database.db, testChain());
  const request = frontierSeasonRequest({ ...devcon, presetId: 5 });
  for (const field of ["version", "gameStartTime", "durationSeconds"] as const)
    await expect(launches.enqueue("game", { ...request, [field]: undefined })).rejects.toThrow(
      "explicit preset, start and duration",
    );
  await expect(launches.enqueue("game", { ...request, gameStartTime: "2026-11-03T06:30:00.500Z" })).rejects.toThrow(
    "tick",
  );
  expect(await launches.list("madara.frontier")).toEqual([]);
});
