import { Effect } from "effect";
import { afterEach, beforeEach, expect, test } from "vitest";
import { D1CalendarStore } from "./calendar-store";
import { runLaunchSchedule } from "./schedule";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase } from "./test-database";

let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  await database.close();
});

const at = (iso: string) => new Date(iso);
const stores = () => {
  const launches = new D1LaunchStore(database.db);
  const slots = new D1SlotStore(database.db);
  const calendar = new D1CalendarStore(database.db);
  const tick = (now: Date) => Effect.runPromise(runLaunchSchedule(launches, slots, calendar, now));
  return { launches, slots, calendar, tick };
};

test("the calendar creates the Frontier season game once, at its start, running to its planned end", async () => {
  const { launches, calendar, tick } = stores();
  const season = {
    phase: "frontier" as const,
    startsAt: "2027-01-01T00:00:00.000Z",
    endsAt: "2027-02-01T00:00:00.000Z",
  };
  await calendar.set(season, Date.now());

  await tick(at("2026-12-31T23:59:00Z"));
  expect(await launches.list("madara.frontier")).toEqual([]);
  await tick(at("2027-01-01T00:00:00Z"));
  await tick(at("2027-01-01T00:01:00Z"));
  await tick(at("2027-02-01T00:01:00Z"));
  const runs = await launches.list("madara.frontier");
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({
    name: "frontier-1798761600",
    request: { gameStartTime: season.startsAt, durationSeconds: 31 * 86_400 },
  });
});

test("Blitz slots are scheduled only inside the Blitz window, and none outside it", async () => {
  const { slots, calendar, tick } = stores();
  const window = { phase: "blitz" as const, startsAt: "2027-01-10T00:00:00.000Z", endsAt: "2027-01-12T00:00:00.000Z" };
  await calendar.set(window, Date.now());

  await tick(at("2027-01-08T12:00:00Z"));
  await tick(at("2027-01-10T12:00:00Z"));
  await tick(at("2027-01-12T12:00:00Z"));
  expect((await slots.list()).map(({ name }) => name)).toEqual(["blitz-20270110-2000"]);
});

test("a phase moves until it starts; a started Frontier season keeps its start and its end", async () => {
  const { calendar } = stores();
  const now = Date.parse("2026-12-01T00:00:00Z");
  const frontier = {
    phase: "frontier" as const,
    startsAt: "2027-01-01T00:00:00.000Z",
    endsAt: "2027-02-01T00:00:00.000Z",
  };
  await calendar.set(frontier, now);
  const moved = { ...frontier, startsAt: "2027-01-02T00:00:00.000Z", endsAt: "2027-03-01T00:00:00.000Z" };
  expect(await calendar.set(moved, now)).toEqual(moved);
  expect(await calendar.list()).toEqual([moved]);

  const running = Date.parse("2027-01-05T00:00:00Z");
  await expect(calendar.set({ ...moved, endsAt: "2027-04-01T00:00:00.000Z" }, running)).rejects.toThrow("end is fixed");
  await expect(calendar.set({ ...moved, startsAt: "2027-01-03T00:00:00.000Z" }, running)).rejects.toThrow("start");
  expect(await calendar.list()).toEqual([moved]);

  // A running Blitz window may still end sooner or later; an ended season makes room for the next.
  const blitz = { phase: "blitz" as const, startsAt: "2027-01-02T00:00:00.000Z", endsAt: "2027-02-01T00:00:00.000Z" };
  await calendar.set(blitz, now);
  expect(await calendar.set({ ...blitz, endsAt: "2027-01-20T00:00:00.000Z" }, running)).toMatchObject({
    endsAt: "2027-01-20T00:00:00.000Z",
  });
  const next = { phase: "frontier" as const, startsAt: "2027-04-01T00:00:00.000Z", endsAt: "2027-08-01T00:00:00.000Z" };
  expect(await calendar.set(next, Date.parse("2027-03-02T00:00:00Z"))).toEqual(next);
});
