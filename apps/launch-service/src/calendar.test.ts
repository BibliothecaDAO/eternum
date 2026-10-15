import { slotValueFixture, registrationIdentityFixture } from "./test-database";
import { Effect } from "effect";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { D1CalendarStore } from "./calendar-store";
import { runLaunchSchedule } from "./schedule";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, testChain } from "./test-database";
import { blitzSlotName, day, frontierSeasonEnd } from "./test-dates";

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
  const slots = new D1SlotStore(database.db, launches, slotValueFixture(1), registrationIdentityFixture);
  const calendar = new D1CalendarStore(database.db);
  const tick = (now: Date) => {
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    return Effect.runPromise(runLaunchSchedule(launches, slots, calendar));
  };
  return { launches, slots, calendar, tick };
};

test.each([1, 2, 21, 30])(
  "the calendar creates a %i-bag Frontier game once with the operator’s dates",
  async (bags) => {
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
  },
);

test("Blitz slots are scheduled only inside the Blitz window, and none outside it", async () => {
  const { slots, calendar, tick } = stores();
  const window = { phase: "blitz" as const, startsAt: day(9).toISOString(), endsAt: day(11).toISOString() };
  await calendar.set(window, Date.now());

  await tick(day(7, 12));
  await tick(day(9, 12));
  await tick(day(11, 12));
  expect((await slots.list()).map(({ name }) => name)).toEqual([blitzSlotName(day(9, 20))]);
  expect((await slots.list())[0]!.closesAt).toBe(day(9, 19, 55).toISOString());
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

  // A running Blitz window may still end sooner or later; an ended season makes room for the next.
  const blitz = { phase: "blitz" as const, startsAt: "2027-01-02T00:00:00.000Z", endsAt: "2027-02-01T00:00:00.000Z" };
  await calendar.set(blitz, now);
  expect(await calendar.set({ ...blitz, endsAt: "2027-01-20T00:00:00.000Z" }, running)).toMatchObject({
    endsAt: "2027-01-20T00:00:00.000Z",
  });
  const next = {
    phase: "frontier" as const,
    startsAt: "2027-04-01T00:00:00.000Z",
    endsAt: frontierSeasonEnd("2027-04-01T00:00:00.000Z"),
  };
  expect(await calendar.set(next, Date.parse("2027-03-22T00:00:00Z"))).toEqual(next);
});

test.each([0, 0.5, 1.5, 9.3])("refuses %s bags and names the two nearest valid ends without writing", async (bags) => {
  const { calendar } = stores();
  const startsAt = day(0).toISOString();
  const lower = Math.max(1, Math.floor(bags));
  const bagMs = Date.parse(frontierSeasonEnd(startsAt, 1)) - Date.parse(startsAt);
  const endsAt = new Date(Date.parse(startsAt) + bags * bagMs).toISOString();
  await expect(calendar.set({ phase: "frontier", startsAt, endsAt }, Date.now())).rejects.toThrow(
    `nearest valid ends: ${frontierSeasonEnd(startsAt, lower)}, ${frontierSeasonEnd(startsAt, lower + 1)}`,
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

test("a malformed stored Frontier season cannot stop Blitz creation or freezing", async () => {
  const { launches, slots, calendar, tick } = stores();
  // Stored before the calendar checked seasons: set refuses one now.
  await database.db
    .prepare("INSERT INTO season_phases (phase, starts_at, ends_at, updated_at) VALUES ('frontier', ?, ?, ?)")
    .bind(day(0).getTime() + 500, day(31).getTime(), Date.now())
    .run();
  await calendar.set({ phase: "blitz", startsAt: day(0).toISOString(), endsAt: day(31).toISOString() }, Date.now());
  await slots.create("due", new Date(Math.floor(Date.now() / 1000) * 1000 + 60_000).toISOString());
  await database.db.prepare("UPDATE playtest_slots SET closes_at = 0").run();
  await tick(day(1));
  expect((await slots.list()).map(({ name }) => name)).toContain(blitzSlotName(day(1, 11)));
  expect((await launches.list("madara.blitz")).map(({ name }) => name)).toContain("due-1");
});

test("a conflicting timetable slot cannot stop a due roster from freezing", async () => {
  const { launches, slots, calendar, tick } = stores();
  await calendar.set({ phase: "blitz", startsAt: day(0).toISOString(), endsAt: day(31).toISOString() }, Date.now());
  await slots.create("due", new Date(Math.floor(Date.now() / 1000) * 1000 + 60_000).toISOString());
  await database.db.prepare("UPDATE playtest_slots SET closes_at = 0").run();
  await slots.create(blitzSlotName(day(1, 11)), day(1, 10).toISOString());
  await tick(day(1));
  expect((await launches.list("madara.blitz")).map(({ name }) => name)).toContain("due-1");
});

const enteredWindow = {
  startsAt: "2000-01-01T07:00:00.000Z",
  endsAt: frontierSeasonEnd("2000-01-01T07:00:00.000Z", 2),
};

test("opening both phases after their start schedules Frontier and the next Blitz slot on the next tick", async () => {
  const now = Date.parse("2000-01-01T18:00:00Z");
  vi.spyOn(Date, "now").mockReturnValue(now);
  const { calendar, launches, slots, tick } = stores();
  for (const phase of ["frontier", "blitz"] as const) {
    const entered = { phase, ...enteredWindow };
    expect(await calendar.set(entered, now)).toEqual(entered);
  }
  await tick(new Date(now));
  expect(await launches.list("madara.frontier")).toMatchObject([
    { request: { gameStartTime: enteredWindow.startsAt, durationSeconds: 160 * 3600 } },
  ]);
  expect(await slots.list()).toMatchObject([
    { name: "blitz-20000101-2000", closesAt: "2000-01-01T19:55:00.000Z", closed: false },
  ]);
});

test.each([
  ["frontier", 0],
  ["frontier", 1000],
  ["blitz", 0],
  ["blitz", 1000],
] as const)("an unset %s phase refuses at or beyond its end (%i ms)", async (phase, elapsed) => {
  const { calendar } = stores();
  await expect(calendar.set({ phase, ...enteredWindow }, Date.parse(enteredWindow.endsAt) + elapsed)).rejects.toThrow(
    "A phase must end in the future",
  );
  expect(await calendar.list()).toEqual([]);
});

test.each(["frontier", "blitz"] as const)("a late-opened %s phase still keeps its running start", async (phase) => {
  const { calendar } = stores();
  const now = Date.parse("2000-01-01T18:00:00Z");
  const entered = { phase, ...enteredWindow };
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

test("schedule failures log the fixed underlying code and still attempt due freezes", async () => {
  const { slots, calendar, tick } = stores();
  vi.spyOn(calendar, "list").mockRejectedValue(new Error("ledger_head_unconfirmed: Bearer secret-value"));
  const freeze = vi.spyOn(slots, "freezeDueSlots");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await tick(day(1));
  expect(freeze).toHaveBeenCalledOnce();
  expect(log).toHaveBeenCalledWith(
    "launch_schedule_step_failed",
    expect.objectContaining({ code: "ledger_head_unconfirmed" }),
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain("secret-value");
});
