import { Effect } from "effect";
import { afterEach, beforeEach, expect, test } from "vitest";
import { D1CalendarStore } from "./calendar-store";
import { runLaunchSchedule } from "./schedule";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, testChain } from "./test-database";
import { blitzSlotName, day } from "./test-dates";

let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  await database.close();
});

const stores = () => {
  const launches = new D1LaunchStore(database.db, testChain());
  const slots = new D1SlotStore(database.db, launches);
  const calendar = new D1CalendarStore(database.db);
  const tick = (now: Date) => Effect.runPromise(runLaunchSchedule(launches, slots, calendar, now));
  return { launches, slots, calendar, tick };
};

test("the calendar creates the Frontier season game once, at its start, running to its planned end", async () => {
  const { launches, calendar, tick } = stores();
  const season = {
    phase: "frontier" as const,
    startsAt: day(0).toISOString(),
    endsAt: day(31).toISOString(),
  };
  await calendar.set(season, Date.now());

  await tick(day(-1, 23, 59));
  expect(await launches.list("madara.frontier")).toEqual([]);
  await tick(day(0));
  await tick(day(0, 0, 1));
  await tick(day(31, 0, 1));
  const runs = await launches.list("madara.frontier");
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({
    name: `frontier-${day(0).getTime() / 1_000}`,
    request: { gameStartTime: season.startsAt, durationSeconds: 31 * 86_400 },
  });
});

test("Blitz slots are scheduled only inside the Blitz window, and none outside it", async () => {
  const { slots, calendar, tick } = stores();
  const window = { phase: "blitz" as const, startsAt: day(9).toISOString(), endsAt: day(11).toISOString() };
  await calendar.set(window, Date.now());

  await tick(day(7, 12));
  await tick(day(9, 12));
  await tick(day(11, 12));
  expect((await slots.list()).map(({ name }) => name)).toEqual([blitzSlotName(day(9, 20))]);
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

test("a malformed stored Frontier season cannot stop Blitz creation or freezing", async () => {
  const { launches, slots, calendar, tick } = stores();
  const offSecondStart = new Date(day(0).getTime() + 500).toISOString();
  await calendar.set({ phase: "frontier", startsAt: offSecondStart, endsAt: day(31).toISOString() }, Date.now());
  await calendar.set({ phase: "blitz", startsAt: day(0).toISOString(), endsAt: day(31).toISOString() }, Date.now());
  await slots.create("due", new Date(Date.now() + 60_000).toISOString());
  await slots.register("due", [{ realmsId: null, account: "0x123" }]);
  await database.db.prepare("UPDATE playtest_slots SET closes_at = 0").run();
  await tick(day(1));
  expect((await slots.list()).map(({ name }) => name)).toContain(blitzSlotName(day(1, 11)));
  expect((await launches.list("madara.blitz")).map(({ name }) => name)).toContain("due-1");
});

test("a conflicting timetable slot cannot stop a due roster from freezing", async () => {
  const { launches, slots, calendar, tick } = stores();
  await calendar.set({ phase: "blitz", startsAt: day(0).toISOString(), endsAt: day(31).toISOString() }, Date.now());
  await slots.create("due", new Date(Date.now() + 60_000).toISOString());
  await slots.register("due", [{ realmsId: null, account: "0x123" }]);
  await database.db.prepare("UPDATE playtest_slots SET closes_at = 0").run();
  await slots.create(blitzSlotName(day(1, 11)), day(1, 10).toISOString());
  await tick(day(1));
  expect((await launches.list("madara.blitz")).map(({ name }) => name)).toContain("due-1");
});
