import { Schema } from "effect";
import { Hono } from "hono";
import type { LaunchAppEnv } from "./auth";
import { CalendarConflict, type CalendarStore } from "./calendar";

const Instant = Schema.String.pipe(
  Schema.check(Schema.makeFilter((value: string) => Number.isFinite(Date.parse(value)))),
);
const PhaseRequest = Schema.Struct({ startsAt: Instant, endsAt: Instant });
const PHASES = new Set(["frontier", "blitz"]);

/**
 * /api/factory/calendar: the season calendar, public to read. Launchers (and operator automation) set a phase's start
 * and end; /api/factory/* already refuses writes from anyone else.
 */
export function createCalendarRoutes(calendar: CalendarStore) {
  const app = new Hono<LaunchAppEnv>();
  app.get("/", async (context) => context.json({ phases: await calendar.list() }));
  app.put("/:phase", async (context) => {
    const phase = context.req.param("phase");
    if (!PHASES.has(phase)) return context.json({ error: "Unknown season phase" }, 404);
    let dates: typeof PhaseRequest.Type;
    try {
      dates = Schema.decodeUnknownSync(PhaseRequest)(await context.req.json());
    } catch {
      return context.json({ error: "A phase needs a start and an end" }, 400);
    }
    try {
      return context.json(await calendar.set({ phase: phase as "frontier" | "blitz", ...dates }, Date.now()));
    } catch (error) {
      if (error instanceof CalendarConflict) return context.json({ error: error.message }, 409);
      throw error;
    }
  });
  return app;
}
