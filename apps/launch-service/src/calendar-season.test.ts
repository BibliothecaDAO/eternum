import { frontierSeasonOnePreset } from "../../../config/source/frontier/season-one";
import { DAYS_PER_BAG, seasonSeconds } from "../../../packages/core/src/utils/days";
import { FRONTIER_ARMIES_TICK_SECONDS } from "../../../config/source/frontier/clock";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { D1CalendarStore } from "./calendar-store";
import { createCalendarRoutes } from "./calendar-routes";
import { frontierSeasonRequest } from "./schemas";
import { scheduleFrontierSeason } from "./schedule";
import { D1LaunchStore } from "./store";
import { toFactoryRunRecord } from "./model";
import { createLaunchTestDatabase, testChain } from "./test-database";
import type { FrontierSeasonPhase } from "./calendar";

let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.close();
});
const START = "2026-11-08T18:30:00.000Z";
const bagSeconds = seasonSeconds(1, frontierSeasonOnePreset.dayUnitSeconds);
const season = (bags: number): FrontierSeasonPhase => ({
  phase: "frontier",
  startsAt: START,
  endsAt: new Date(Date.parse(START) + bags * bagSeconds * 1000).toISOString(),
});
const oneBag = season(1);
const twoBags = season(2);
const before = Date.parse(START) - 1;
const put = (body: unknown, phase = "frontier", now = before) =>
  createCalendarRoutes(new D1CalendarStore(database.db), () => now).request(`/${phase}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("precreation, interrupted launch and cron keep one immutable request, including after a failed retry", async () => {
  await put(oneBag);
  const launches = new D1LaunchStore(database.db, testChain());
  const request = frontierSeasonRequest(oneBag);
  const first = await launches.enqueue(request);
  expect((await put(twoBags)).status).toBe(409);
  expect((await put(oneBag)).status).toBe(200);
  expect(await scheduleFrontierSeason(launches, oneBag)).toMatchObject({ id: first.id, status: "queued" });
  expect(await launches.delete(request.environment, request.gameName)).toBe(false);
  expect(toFactoryRunRecord(first).recovery.canDelete).toBe(false);
  const running = (await launches.startNext(Date.now()))!;
  const restarted = new D1LaunchStore(database.db, testChain());
  expect(await restarted.startNext(Date.now())).toMatchObject({ id: running.id, attempts: 2 });
  await restarted.fail(running.id, "interrupted after create_game");
  await expect(restarted.enqueue({ ...request, durationSeconds: 2 * bagSeconds })).rejects.toThrow(
    "another season window",
  );
  expect(await restarted.find(request.environment, request.gameName)).toMatchObject({
    id: running.id,
    status: "failed",
    request,
  });
  const continued = await restarted.enqueue(request);
  expect(continued).toMatchObject({ status: "queued", request });
  expect(await scheduleFrontierSeason(restarted, oneBag)).toMatchObject({ id: continued.id, request });
  expect(await restarted.list("madara.frontier")).toHaveLength(1);
});

test("a stale cron read cannot queue a season after the operator changes its dates", async () => {
  await put(oneBag);
  expect((await put(twoBags)).status).toBe(200);
  const launches = new D1LaunchStore(database.db, testChain());
  await expect(scheduleFrontierSeason(launches, oneBag)).rejects.toThrow("published calendar");
  expect(await launches.list("madara.frontier")).toEqual([]);
  expect(await scheduleFrontierSeason(launches, twoBags)).toMatchObject({
    request: { durationSeconds: 2 * bagSeconds },
  });
});

test("a concurrent calendar edit and precreation agree on one season window", async () => {
  await put(oneBag);
  const launches = new D1LaunchStore(database.db, testChain());
  const [edit, launch] = await Promise.allSettled([put(twoBags), scheduleFrontierSeason(launches, oneBag)]);
  const phases = await new D1CalendarStore(database.db).list();
  const runs = await launches.list("madara.frontier");
  expect(edit.status).toBe("fulfilled");
  if (launch.status === "fulfilled") {
    expect(edit.status === "fulfilled" && edit.value.status).toBe(409);
    expect(phases).toEqual([oneBag]);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.request).toMatchObject({ durationSeconds: bagSeconds });
  } else {
    expect(edit.status === "fulfilled" && edit.value.status).toBe(200);
    expect(phases).toEqual([twoBags]);
    expect(runs).toEqual([]);
  }
});

test("canonical launch requests never fill a missing start or duration", async () => {
  await put(oneBag);
  const launches = new D1LaunchStore(database.db, testChain());
  const request = frontierSeasonRequest(oneBag);
  for (const field of ["gameStartTime", "durationSeconds"] as const)
    await expect(launches.enqueue({ ...request, [field]: undefined })).rejects.toThrow("explicit start and duration");
  await expect(launches.enqueue({ ...request, gameStartTime: "2026-11-08T18:30:00.500Z" })).rejects.toThrow("tick");
  expect(await launches.list("madara.frontier")).toEqual([]);
});

test("the published race calendar admits its full season and refuses a tick beyond it before enqueue", async () => {
  const preset = frontierSeasonOnePreset;
  const start = Date.parse(START);
  const duration = seasonSeconds(preset.race.seasonDays / DAYS_PER_BAG, preset.dayUnitSeconds);
  const full: FrontierSeasonPhase = {
    phase: "frontier",
    startsAt: START,
    endsAt: new Date(start + duration * 1000).toISOString(),
  };
  expect(
    (await put({ ...full, endsAt: new Date(start + (duration + FRONTIER_ARMIES_TICK_SECONDS) * 1000).toISOString() }))
      .status,
  ).toBe(409);
  expect(await new D1CalendarStore(database.db).list()).toEqual([]);
  expect((await put(full)).status).toBe(200);
  const launches = new D1LaunchStore(database.db, testChain());
  const run = await scheduleFrontierSeason(launches, full);
  expect(run.request).toEqual(frontierSeasonRequest(full));
  expect(run.request).toMatchObject({ durationSeconds: duration });
  expect(await scheduleFrontierSeason(launches, full)).toMatchObject({ id: run.id });
});

test("the calendar keeps no preset: a body that names one is stored as dates alone", async () => {
  expect((await put({ ...oneBag, presetId: 7 })).status).toBe(200);
  expect(await new D1CalendarStore(database.db).list()).toEqual([oneBag]);
});
