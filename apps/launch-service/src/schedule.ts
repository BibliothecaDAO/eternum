import { Effect } from "effect";
import { isRunning, type CalendarStore, type SeasonPhase } from "./calendar";
import { frontierSeasonRequest } from "./schemas";
import type { SlotStore } from "./slots";
import { databaseOperation, type LaunchServiceStore } from "./store";

/**
 * One cron tick, read from the season calendar: the Frontier season game exists once its season has started, the next
 * Blitz slot exists when it closes inside the Blitz window, and a slot whose registration closed is frozen into queued
 * games. `now` places the tick in the calendar and names the next slot; whether a slot has closed is the store's clock,
 * as registration's is. Every step is idempotent, so overlapping ticks agree.
 */
export const runLaunchSchedule = (store: LaunchServiceStore, slots: SlotStore, calendar: CalendarStore, now: Date) =>
  Effect.gen(function* () {
    const phases = yield* databaseOperation("read the season calendar", () => calendar.list());
    const frontier = phases.find(({ phase }) => phase === "frontier");
    if (frontier && isRunning(frontier, now.getTime()))
      yield* databaseOperation("schedule frontier season", () => scheduleFrontierSeason(store, frontier));
    const blitz = phases.find(({ phase }) => phase === "blitz");
    const slot = nextBlitzSlot(now);
    if (blitz && closesInside(blitz, slot.closesAt))
      yield* databaseOperation("schedule blitz slot", () => slots.create(slot.name, slot.closesAt));
    yield* databaseOperation("freeze playtest roster", () => slots.freezeNextDue());
  });

/** A slot belongs to the Blitz window when its games start inside it: when its registration closes. */
const closesInside = (window: SeasonPhase, closesAt: string) => isRunning(window, Date.parse(closesAt));

/**
 * The season is created once, whatever becomes of its run, so a tick never resets a launch in progress; a season whose
 * launch failed is continued by a launcher like any failed run.
 */
export const scheduleFrontierSeason = (store: LaunchServiceStore, season: SeasonPhase) =>
  store.schedule("game", frontierSeasonRequest(season));

/** Free Blitz slots close at these UTC hours every day; registration is open from the previous close. */
const BLITZ_SLOT_HOURS_UTC = [11, 20] as const;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const pad = (value: number) => String(value).padStart(2, "0");

/** The next slot is the first timetable hour after `now`; its name is that instant, so every worker names the same slot. */
export const nextBlitzSlot = (now: Date): { name: string; closesAt: string } => {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const closings = [0, DAY_MS].flatMap((day) => BLITZ_SLOT_HOURS_UTC.map((hour) => midnight + day + hour * HOUR_MS));
  const closesAt = new Date(closings.find((closing) => closing > now.getTime())!);
  const day = `${closesAt.getUTCFullYear()}${pad(closesAt.getUTCMonth() + 1)}${pad(closesAt.getUTCDate())}`;
  return { name: `blitz-${day}-${pad(closesAt.getUTCHours())}00`, closesAt: closesAt.toISOString() };
};
