import { slotResolver } from "./paid-blitz";
import { slotValueFixture, registrationIdentityFixture } from "./test-database";
import { Effect } from "effect";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { D1CalendarStore } from "./calendar-store";
import { nextBlitzGame, runLaunchSchedule } from "./schedule";
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
  const value = slotValueFixture(1);
  const slots = new D1SlotStore(database.db, launches, value, slotResolver(value, registrationIdentityFixture));
  const calendar = new D1CalendarStore(database.db);
  const tick = (now: Date) => {
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    return Effect.runPromise(runLaunchSchedule(launches, slots, calendar));
  };
  return { launches, slots, calendar, tick, value };
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
  expect((await slots.list()).map(({ name }) => name)).toEqual([blitzSlotName(day(9, 13, 30))]);
  expect((await slots.list())[0]!.closesAt).toBe(day(9, 13, 25).toISOString());
});

test("the timetable covers all sixteen UTC starts, including half hours and midnight rollover", async () => {
  const { slots, calendar, tick } = stores();
  await calendar.set({ phase: "blitz", startsAt: day(0).toISOString(), endsAt: day(3).toISOString() }, Date.now());
  const times = [
    "0000",
    "0130",
    "0300",
    "0430",
    "0600",
    "0730",
    "0900",
    "1030",
    "1200",
    "1330",
    "1500",
    "1630",
    "1800",
    "1930",
    "2100",
    "2230",
  ];
  const starts = times.map((time) => day(1, Number(time.slice(0, 2)), Number(time.slice(2))));
  for (const start of starts) await tick(new Date(start.getTime() - 6 * 60_000));
  const date = day(1).toISOString().slice(0, 10).replaceAll("-", "");
  expect((await slots.list()).map(({ name, closesAt }) => ({ name, closesAt }))).toEqual(
    times.map((time, i) => ({
      name: `blitz-${date}-${time}`,
      closesAt: new Date(starts[i]!.getTime() - 5 * 60_000).toISOString(),
    })),
  );
});

test("at the exact close it schedules the next start; duplicate ticks keep the same slot identity", async () => {
  const { slots, calendar, tick, value } = stores();
  await calendar.set({ phase: "blitz", startsAt: day(0).toISOString(), endsAt: day(2).toISOString() }, Date.now());
  const open = vi.spyOn(value, "openSlot");
  await tick(new Date(day(0, 1, 25).getTime() - 1));
  const first = await slots.list();
  expect(first).toMatchObject([{ name: blitzSlotName(day(0, 1, 30)), closesAt: day(0, 1, 25).toISOString() }]);
  await tick(new Date(day(0, 1, 25).getTime() - 1));
  expect(await slots.list()).toEqual(first);
  expect(open.mock.calls[0]).toEqual(open.mock.calls[1]);
  expect(open).toHaveBeenCalledWith(
    { chainId: first[0]!.chainId, slotId: first[0]!.slotId },
    { start: day(0, 1, 25).getTime() / 1000, end: day(0, 2, 30).getTime() / 1000 },
  );
  await tick(day(0, 1, 25));
  expect((await slots.list()).map(({ name }) => name)).toEqual([
    blitzSlotName(day(0, 1, 30)),
    blitzSlotName(day(0, 3)),
  ]);
});

test.each([
  ["close equals season start", day(0, 1, 25), day(0, 2, 40, 1), true],
  ["close precedes season start", day(0, 1, 25, 1), day(0, 2, 40, 1), false],
  ["only 600 seconds remain after play", day(0), day(0, 2, 40), false],
  ["less than 600 seconds remain after play", day(0), day(0, 2, 39, 59), false],
  ["play itself crosses season end", day(0), day(0, 2, 29, 59), false],
] as const)("a complete slot window: %s", async (_, start, end, allowed) => {
  const { slots, calendar, tick, value } = stores();
  await calendar.set({ phase: "blitz", startsAt: start.toISOString(), endsAt: end.toISOString() }, Date.now());
  const open = vi.spyOn(value, "openSlot");
  await tick(day(0, 1));
  expect((await slots.list()).map(({ name }) => name)).toEqual(allowed ? [blitzSlotName(day(0, 1, 30))] : []);
  expect(open).toHaveBeenCalledTimes(allowed ? 1 : 0);
});

test("the last legal grid slot survives but the following midnight cannot cross the season's end", async () => {
  const { slots, calendar, tick } = stores();
  await calendar.set(
    { phase: "blitz", startsAt: day(0, 0, 40).toISOString(), endsAt: day(7, 0, 40).toISOString() },
    Date.now(),
  );
  await tick(day(6, 22));
  await tick(day(6, 23));
  expect((await slots.list()).map(({ name, closesAt }) => ({ name, closesAt }))).toEqual([
    { name: blitzSlotName(day(6, 22, 30)), closesAt: day(6, 22, 25).toISOString() },
  ]);
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

test("a malformed stored Frontier season cannot stop Blitz slot creation", async () => {
  const { slots, calendar, tick } = stores();
  // Stored before the calendar checked seasons: set refuses one now.
  await database.db
    .prepare("INSERT INTO season_phases (phase, starts_at, ends_at, updated_at) VALUES ('frontier', ?, ?, ?)")
    .bind(day(0).getTime() + 500, day(31).getTime(), Date.now())
    .run();
  await calendar.set({ phase: "blitz", startsAt: day(0).toISOString(), endsAt: day(31).toISOString() }, Date.now());
  await tick(day(1));
  expect((await slots.list()).map(({ name }) => name)).toContain(blitzSlotName(day(1, 1, 30)));
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
    { name: "blitz-20000101-1930", closesAt: "2000-01-01T19:25:00.000Z", closed: false },
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

test("schedule failures log the fixed underlying code, and the tick leaves freezing to the registrar", async () => {
  const { slots, calendar, tick } = stores();
  vi.spyOn(calendar, "list").mockRejectedValue(new Error("ledger_head_unconfirmed: Bearer secret-value"));
  const freeze = vi.spyOn(slots, "freezeDueSlots");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await tick(day(1));
  expect(freeze).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith(
    "launch_schedule_step_failed",
    expect.objectContaining({ code: "ledger_head_unconfirmed" }),
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain("secret-value");
});

test("the schedule opens exactly the game the calendar names next, at the moment it says entry opens", async () => {
  const { slots, calendar, tick } = stores();
  await calendar.set({ phase: "blitz", startsAt: day(1, 10).toISOString(), endsAt: day(2).toISOString() }, Date.now());
  const named = nextBlitzGame(await calendar.list(), day(1, 8).getTime());
  expect(named).toMatchObject({ name: blitzSlotName(day(1, 10, 30)), opensAt: day(1, 8, 55).toISOString() });
  // Before the moment it names, nothing opens; at it, that game does.
  await tick(new Date(Date.parse(named!.opensAt) - 1));
  expect(await slots.list()).toEqual([]);
  await tick(new Date(named!.opensAt));
  expect((await slots.list()).map(({ name, closesAt }) => ({ name, closesAt }))).toEqual([
    { name: named!.name, closesAt: named!.closesAt },
  ]);
});

// The only running Frontier date change is reconciled from both contracts, not approved by the PUT body.
test("reconciles the approved extension only after both chains agree, with retries and Blitz unchanged", async () => {
  const approved = (await import("../../../config/source/frontier/extension.json")).default;
  const now = (approved.oldEnd - 3600) * 1000;
  const before = {
    phase: "frontier" as const,
    startsAt: new Date(approved.start * 1000).toISOString(),
    endsAt: new Date(approved.oldEnd * 1000).toISOString(),
  };
  const after = { ...before, endsAt: new Date(approved.end * 1000).toISOString() };
  const blitz = { phase: "blitz" as const, startsAt: "2026-10-21T10:30:00.000Z", endsAt: "2026-10-28T10:30:00.000Z" };
  const ordinary = new D1CalendarStore(database.db);
  await ordinary.set(before, approved.start * 1000 - 1);
  await ordinary.set(blitz, approved.start * 1000 - 1);
  await expect(ordinary.set(after, now)).rejects.toThrow("Frontier extension calendar differs");
  const verify = vi
    .fn()
    .mockRejectedValueOnce(new Error("extension_not_confirmed_on_both_chains"))
    .mockResolvedValue({ worldBlock: 50, ledgerBlock: 60 });
  const guarded = new D1CalendarStore(database.db, verify);
  await expect(guarded.set(after, now)).rejects.toThrow("extension_not_confirmed_on_both_chains");
  expect(await guarded.list()).toEqual([before, blitz]);
  expect(await guarded.set(after, now)).toEqual(after);
  expect(await guarded.set(after, now)).toEqual(after);
  expect(verify).toHaveBeenCalledTimes(3);
  expect(await guarded.list()).toEqual([after, blitz]);
  // A fresh store sees persisted dates, and arbitrary future edits still use the fixed-end rule.
  expect(await new D1CalendarStore(database.db).list()).toEqual([after, blitz]);
  await expect(
    guarded.set({ ...after, endsAt: new Date((approved.end + 80 * 3600) * 1000).toISOString() }, now),
  ).rejects.toThrow("A started Frontier season's end is fixed");
});

test("refuses a calendar changed while extension confirmation was in flight", async () => {
  const approved = (await import("../../../config/source/frontier/extension.json")).default;
  const before = {
    phase: "frontier" as const,
    startsAt: new Date(approved.start * 1000).toISOString(),
    endsAt: new Date(approved.oldEnd * 1000).toISOString(),
  };
  const ordinary = new D1CalendarStore(database.db);
  await ordinary.set(before, approved.start * 1000 - 1);
  const guarded = new D1CalendarStore(database.db, async () => {
    await database.db.prepare("UPDATE season_phases SET ends_at = ends_at + 1 WHERE phase = 'frontier'").run();
  });
  await expect(
    guarded.set({ ...before, endsAt: new Date(approved.end * 1000).toISOString() }, (approved.oldEnd - 1) * 1000),
  ).rejects.toThrow("The calendar changed; reload and edit again");
  expect(Date.parse((await guarded.list())[0]!.endsAt)).toBe(approved.oldEnd * 1000 + 1);
});
