import { expect, test, vi } from "vitest";
import { Hono } from "hono";
import type { SeasonPhase } from "./calendar";
import { createCalendarRoutes } from "./calendar-routes";
import { blitzSlotName, day } from "./test-dates";

test.each(["startsAt", "endsAt"])("rejects sub-second %s before persisting the calendar", async (field) => {
  const set = vi.fn();
  const app = new Hono();
  app.route("/", createCalendarRoutes({ list: async () => [], set }));
  const response = await app.request("/frontier", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      startsAt: "2027-01-01T00:00:00Z",
      endsAt: "2027-02-01T00:00:00Z",
      [field]: "2027-01-02T00:00:00.500Z",
    }),
  });
  expect(response.status).toBe(400);
  expect(set).not.toHaveBeenCalled();
});

/** The calendar as a client reads it at `now`: its phases and the next Blitz game the schedule opens. */
const read = async (phases: SeasonPhase[], now: Date) => {
  const app = new Hono();
  app.route(
    "/",
    createCalendarRoutes({ list: async () => phases, set: vi.fn() }, () => now.getTime()),
  );
  const response = await app.request("/");
  expect(response.status).toBe(200);
  return (await response.json()) as { phases: SeasonPhase[]; nextBlitz: unknown };
};
const blitzWindow = (startsAt: Date, endsAt: Date): SeasonPhase => ({
  phase: "blitz",
  startsAt: startsAt.toISOString(),
  endsAt: endsAt.toISOString(),
});
/** The game starting at `startsAt`, as the schedule names and opens it: entry from the start before it closes. */
const game = (startsAt: Date) => ({
  name: blitzSlotName(startsAt),
  startsAt: startsAt.toISOString(),
  closesAt: new Date(startsAt.getTime() - 5 * 60_000).toISOString(),
  opensAt: new Date(startsAt.getTime() - 95 * 60_000).toISOString(),
});

test("names the window's first game, and when its entry opens, before the window starts", async () => {
  const window = blitzWindow(day(9), day(11));
  // 00:00's entry would close at 23:55 the day before, outside the window: its first game is 01:30.
  expect((await read([window], day(7, 12))).nextBlitz).toEqual(game(day(9, 1, 30)));
});

test("names the timetable's next start inside the window, its entry open since the start before it closed", async () => {
  const window = blitzWindow(day(9), day(11));
  expect((await read([window], day(9, 10, 8))).nextBlitz).toEqual(game(day(9, 10, 30)));
  // At the exact close of 10:30's entry, the next is 12:00, whose entry opens then.
  expect((await read([window], day(9, 10, 25))).nextBlitz).toEqual(game(day(9, 12)));
});

test("names none once no game fits before the window ends, and none without a Blitz window", async () => {
  const window = blitzWindow(day(9), day(11));
  expect((await read([window], day(10, 23))).nextBlitz).toBeNull();
  expect((await read([window], day(12))).nextBlitz).toBeNull();
  const frontier: SeasonPhase = {
    phase: "frontier",
    presetId: 5,
    startsAt: day(0).toISOString(),
    endsAt: day(70).toISOString(),
  };
  expect((await read([frontier], day(9, 10))).nextBlitz).toBeNull();
});

test("names the owner's 12:00 game, its entry opening at 10:25, at 10:08 on a window opening at 10:30", async () => {
  // Production's Blitz window of 21 October 2026, read at 10:08: 10:30's entry would close at 10:25, before the window.
  const window = blitzWindow(day(1, 10, 30), day(8, 10, 30));
  expect((await read([window], day(1, 10, 8))).nextBlitz).toEqual(game(day(1, 12)));
});
