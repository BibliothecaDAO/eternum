import { Effect } from "effect";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { D1CalendarStore } from "./calendar-store";
import { runLaunchSchedule } from "./schedule";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, testChain } from "./test-database";
import { day, frontierSeasonEnd } from "./test-dates";

let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.close();
});

const stores = () => {
  const launches = new D1LaunchStore(database.db, testChain());
  const calendar = new D1CalendarStore(database.db);
  const tick = (now: Date) => {
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    return Effect.runPromise(runLaunchSchedule(launches, calendar));
  };
  return { launches, calendar, tick };
};

test.each([1, 2, 10])("the calendar creates a %i-bag Frontier game once with the operator’s dates", async (bags) => {
  const { launches, calendar, tick } = stores();
  const season = {
    phase: "frontier" as const,
    startsAt: day(0).toISOString(),
    endsAt: frontierSeasonEnd(day(0), bags),
  };
  await calendar.set(season, Date.now());

  await tick(day(-1, 23, 59));
  expect(await launches.list("madara.frontier")).toEqual([]);
  await tick(day(0));
  await tick(day(0, 0, 1));
  await tick(day(70, 0, 1));
  const runs = await launches.list("madara.frontier");
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({
    name: `frontier-${day(0).getTime() / 1_000}`,
    request: {
      gameStartTime: season.startsAt,
      durationSeconds: (Date.parse(season.endsAt) - Date.parse(season.startsAt)) / 1000,
    },
  });
});

test("a phase moves until it starts; a started Frontier season keeps its start and its end", async () => {
  const { calendar } = stores();
  const now = Date.parse("2026-12-01T00:00:00Z");
  const frontier = {
    phase: "frontier" as const,
    startsAt: "2027-01-01T00:00:00.000Z",
    endsAt: frontierSeasonEnd("2027-01-01T00:00:00.000Z"),
  };
  await calendar.set(frontier, now);
  const moved = {
    ...frontier,
    startsAt: "2027-01-02T00:00:00.000Z",
    endsAt: frontierSeasonEnd("2027-01-02T00:00:00.000Z"),
  };
  expect(await calendar.set(moved, now)).toEqual(moved);
  expect(await calendar.list()).toEqual([moved]);

  const running = Date.parse("2027-01-05T00:00:00Z");
  await expect(calendar.set({ ...moved, endsAt: "2027-04-01T00:00:00.000Z" }, running)).rejects.toThrow("end is fixed");
  await expect(calendar.set({ ...moved, startsAt: "2027-01-03T00:00:00.000Z" }, running)).rejects.toThrow("start");
  expect(await calendar.list()).toEqual([moved]);
  const next = {
    phase: "frontier" as const,
    startsAt: "2027-04-01T00:00:00.000Z",
    endsAt: frontierSeasonEnd("2027-04-01T00:00:00.000Z"),
  };
  expect(await calendar.set(next, Date.parse("2027-03-22T00:00:00Z"))).toEqual(next);
});

test.each([0.5, 1.5, 9.3])("accepts %s bags without rounding the operator's end", async (bags) => {
  const { calendar } = stores();
  const startsAt = day(0).toISOString();
  const bagMs = Date.parse(frontierSeasonEnd(startsAt, 1)) - Date.parse(startsAt);
  const endsAt = new Date(Date.parse(startsAt) + bags * bagMs).toISOString();
  const phase = { phase: "frontier" as const, startsAt, endsAt };
  expect(await calendar.set(phase, Date.now())).toEqual(phase);
  expect(await calendar.list()).toEqual([phase]);
});

test("refuses a zero-length season without writing", async () => {
  const { calendar } = stores();
  const startsAt = day(0).toISOString();
  await expect(calendar.set({ phase: "frontier", startsAt, endsAt: startsAt }, Date.now())).rejects.toThrow(
    "end after",
  );
  expect(await calendar.list()).toEqual([]);
});

test("refuses a Frontier start off the armies tick", async () => {
  const { calendar } = stores();
  const offTick = new Date(day(0).getTime() + 1_000);
  await expect(
    calendar.set(
      { phase: "frontier", startsAt: offTick.toISOString(), endsAt: frontierSeasonEnd(offTick, 2) },
      Date.now(),
    ),
  ).rejects.toThrow("starts on a 120 s tick");
  expect(await calendar.list()).toEqual([]);
});

const enteredWindow = {
  startsAt: "2000-01-01T07:00:00.000Z",
  endsAt: frontierSeasonEnd("2000-01-01T07:00:00.000Z", 2),
};

test("opening the Frontier phase after its start schedules its season on the next tick", async () => {
  const now = Date.parse("2000-01-01T18:00:00Z");
  vi.spyOn(Date, "now").mockReturnValue(now);
  const { calendar, launches, tick } = stores();
  const entered = { phase: "frontier" as const, ...enteredWindow };
  expect(await calendar.set(entered, now)).toEqual(entered);
  await tick(new Date(now));
  expect(await launches.list("madara.frontier")).toMatchObject([
    { request: { gameStartTime: enteredWindow.startsAt, durationSeconds: 160 * 3600 } },
  ]);
});

test.each([0, 1000])("an unset Frontier phase refuses at or beyond its end (%i ms)", async (elapsed) => {
  const { calendar } = stores();
  await expect(
    calendar.set({ phase: "frontier", ...enteredWindow }, Date.parse(enteredWindow.endsAt) + elapsed),
  ).rejects.toThrow("A phase must end in the future");
  expect(await calendar.list()).toEqual([]);
});

test("a late-opened Frontier phase still keeps its running start", async () => {
  const { calendar } = stores();
  const now = Date.parse("2000-01-01T18:00:00Z");
  const entered = { phase: "frontier" as const, ...enteredWindow };
  await calendar.set(entered, now);
  await expect(calendar.set({ ...entered, startsAt: "2000-01-01T08:00:00.000Z" }, now)).rejects.toThrow(
    "A running phase keeps its start",
  );
  expect(await calendar.list()).toEqual([entered]);
});

test("a late-opened Frontier phase still keeps its running end", async () => {
  const { calendar } = stores();
  const now = Date.parse("2000-01-01T18:00:00Z");
  const entered = { phase: "frontier" as const, ...enteredWindow };
  await calendar.set(entered, now);
  await expect(calendar.set({ ...entered, endsAt: frontierSeasonEnd(enteredWindow.startsAt, 3) }, now)).rejects.toThrow(
    "A started Frontier season's end is fixed",
  );
  expect(await calendar.list()).toEqual([entered]);
});

test("schedule failures log the fixed underlying code", async () => {
  const { calendar, tick } = stores();
  vi.spyOn(calendar, "list").mockRejectedValue(new Error("ledger_head_unconfirmed: Bearer secret-value"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await tick(day(1));
  expect(log).toHaveBeenCalledWith(
    "launch_schedule_step_failed",
    expect.objectContaining({ code: "ledger_head_unconfirmed" }),
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain("secret-value");
});

