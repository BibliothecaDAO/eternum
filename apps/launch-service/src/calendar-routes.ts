import { Schema } from "effect";
import { Hono } from "hono";
import { CalendarConflict, type CalendarStore, type SeasonPhase } from "./calendar";

const Instant = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value: string) => Number.isFinite(Date.parse(value)) && Date.parse(value) % 1_000 === 0),
  ),
);
const Dates = { startsAt: Instant, endsAt: Instant };
const PhaseRequest = Schema.Struct(Dates);
const PHASES = new Set(["frontier"]);

export function createCalendarRoutes(calendar: CalendarStore, now: () => number = Date.now) {
  const app = new Hono();
  app.get("/", async (context) => {
    const phases = await calendar.list();
    return context.json({ phases });
  });
  app.put("/:phase", async (context) => {
    const phase = context.req.param("phase");
    if (!PHASES.has(phase)) return context.json({ error: "Unknown season phase" }, 404);
    let requested: SeasonPhase;
    try {
      const body = await context.req.json();
      requested = { phase: phase as SeasonPhase["phase"], ...Schema.decodeUnknownSync(PhaseRequest)(body) };
    } catch {
      return context.json({ error: "A phase needs whole-second dates" }, 400);
    }
    try {
      return context.json(await calendar.set(requested, now()));
    } catch (error) {
      if (error instanceof CalendarConflict) return context.json({ error: error.message }, 409);
      throw error;
    }
  });
  return app;
}
