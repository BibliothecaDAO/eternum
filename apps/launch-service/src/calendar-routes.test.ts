import { expect, test, vi } from "vitest";
import { createCalendarRoutes } from "./calendar-routes";

test.each(["startsAt", "endsAt"])("rejects sub-second %s before persisting the calendar", async (field) => {
  const set = vi.fn();
  const app = createCalendarRoutes({ list: async () => [], set });
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
