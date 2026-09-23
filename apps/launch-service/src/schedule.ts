import { Effect } from "effect";
import { frontierSeasonRequest } from "./schemas";
import type { SlotStore } from "./slots";
import { databaseOperation, type LaunchServiceStore } from "./store";

/**
 * One cron tick: the Frontier season and the next Blitz slot exist, and a slot whose registration closed is frozen
 * into queued games. `now` names the next slot; whether a slot has closed is the store's clock, as registration's is.
 * Every step is idempotent, so overlapping ticks agree.
 */
export const runLaunchSchedule = (
  store: LaunchServiceStore,
  slots: SlotStore,
  seasonStart: string | undefined,
  now: Date,
) =>
  Effect.gen(function* () {
    if (seasonStart)
      yield* databaseOperation("schedule frontier season", () => scheduleFrontierSeason(store, seasonStart));
    const slot = nextBlitzSlot(now);
    yield* databaseOperation("schedule blitz slot", () => slots.create(slot.name, slot.closesAt));
    yield* databaseOperation("freeze playtest roster", () => slots.freezeNextDue());
  });

/**
 * The season is created once, whatever becomes of its run, so a tick never resets a launch in progress; a season whose
 * launch failed is continued by a launcher like any failed run.
 */
export const scheduleFrontierSeason = (store: LaunchServiceStore, seasonStart: string) =>
  store.schedule("game", frontierSeasonRequest(seasonStart));

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
