import { expect, test, vi } from "vitest";
import { Hono } from "hono";
import { createCalendarRoutes } from "./calendar-routes";

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

test("reads the season's phases and refuses a Blitz phase as unknown", async () => {
  const phases = [{ phase: "frontier" as const, startsAt: "2027-01-01T00:00:00.000Z", endsAt: "2027-02-01T00:00:00.000Z" }];
  const set = vi.fn();
  const app = new Hono();
  app.route("/", createCalendarRoutes({ list: async () => phases, set }));
  expect(await (await app.request("/")).json()).toEqual({ phases });
  const blitz = await app.request("/blitz", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ startsAt: "2027-01-01T00:00:00Z", endsAt: "2027-02-01T00:00:00Z" }),
  });
  expect([blitz.status, await blitz.json()]).toEqual([404, { error: "Unknown season phase" }]);
  expect(set).not.toHaveBeenCalled();
});
