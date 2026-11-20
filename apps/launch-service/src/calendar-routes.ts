import { Schema } from "effect";
import { Hono } from "hono";
import { CalendarConflict, type CalendarStore, type SeasonPhase } from "./calendar";
import { nextBlitzGame } from "./schedule";

const Instant = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value: string) => Number.isFinite(Date.parse(value)) && Date.parse(value) % 1_000 === 0),
  ),
);
const Dates = { startsAt: Instant, endsAt: Instant };
const PhaseRequest = Schema.Struct(Dates);
const PHASES = new Set(["frontier", "blitz"]);

/**
 * /api/factory/calendar: the season calendar, public to read, with the next Blitz game the schedule will open (null
 * when the Blitz window has none left), so a client shows the next start without deriving the timetable. Only the
 * operator token sets a phase's start and end.
 */
export function createCalendarRoutes(calendar: CalendarStore, now: () => number = Date.now) {
  const app = new Hono();
  app.get("/", async (context) => {
    const phases = await calendar.list();
    return context.json({ phases, nextBlitz: nextBlitzGame(phases, now()) });
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
