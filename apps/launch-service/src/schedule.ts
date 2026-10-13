import { launchFailure } from "./errors";
import { BLITZ_SLOT_PREPARATION_SECONDS } from "@realms-world/value-ledger";
import { Effect, Result } from "effect";
import { isRunning, type CalendarStore, type SeasonPhase } from "./calendar";
import { frontierSeasonRequest } from "./schemas";
import type { SlotStore } from "./slots";
import { databaseOperation, type LaunchServiceStore } from "./store";

/**
 * One cron tick, read from the season calendar: the Frontier season game exists once its season has started, the next
 * Blitz slot exists when its games start inside the Blitz window, and a slot whose registration closed is frozen into queued
 * games. Scheduling and slot metadata share the Worker clock; the ledger independently confirms registration has
 * closed before a roster can freeze. Every step is idempotent, so overlapping ticks agree.
 */
export const runLaunchSchedule = (store: LaunchServiceStore, slots: SlotStore, calendar: CalendarStore) =>
  Effect.gen(function* () {
    const now = new Date(Date.now());
    const calendarResult = yield* Effect.result(databaseOperation("read the season calendar", () => calendar.list()));
    if (Result.isSuccess(calendarResult)) {
      const frontier = calendarResult.success.find(({ phase }) => phase === "frontier");
      if (frontier && isRunning(frontier, now.getTime()))
        yield* runScheduleStep("schedule frontier season", () => scheduleFrontierSeason(store, frontier));
      const blitz = calendarResult.success.find(({ phase }) => phase === "blitz");
      const slot = nextBlitzSlot(now);
      if (blitz && startsInside(blitz, slot.closesAt))
        yield* runScheduleStep("schedule blitz slot", () => slots.create(slot.name, slot.closesAt));
    } else {
      console.error("launch_schedule_step_failed", {
        operation: "read the season calendar",
        ...launchFailure(calendarResult.failure),
      });
    }
    yield* runScheduleStep("freeze playtest roster", () => slots.freezeDueSlots());
  });

const runScheduleStep = <A>(operation: string, task: () => Promise<A>) =>
  Effect.gen(function* () {
    const result = yield* Effect.result(databaseOperation(operation, task));
    if (Result.isFailure(result))
      console.error("launch_schedule_step_failed", { operation, ...launchFailure(result.failure) });
  });

/** A slot belongs to the Blitz window when its games start inside it. */
const startsInside = (window: SeasonPhase, closesAt: string) =>
  isRunning(window, Date.parse(closesAt) + BLITZ_SLOT_PREPARATION_SECONDS * 1000);

/**
 * The season is created once, whatever becomes of its run, so a tick never resets a launch in progress; a season whose
 * launch failed is continued only by the operator.
 */
export const scheduleFrontierSeason = (store: LaunchServiceStore, season: SeasonPhase) =>
  store.schedule("game", frontierSeasonRequest(season));

/** Official games start at these UTC hours; registration closes one preparation interval earlier. */
const BLITZ_SLOT_HOURS_UTC = [11, 20] as const;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const pad = (value: number) => String(value).padStart(2, "0");

/** The next timetable start whose registration is still open; its start time also names the slot. */
const nextBlitzSlot = (now: Date): { name: string; closesAt: string } => {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const starts = [0, DAY_MS].flatMap((day) => BLITZ_SLOT_HOURS_UTC.map((hour) => midnight + day + hour * HOUR_MS));
  const startsAt = new Date(starts.find((start) => start - BLITZ_SLOT_PREPARATION_SECONDS * 1000 > now.getTime())!);
  const day = `${startsAt.getUTCFullYear()}${pad(startsAt.getUTCMonth() + 1)}${pad(startsAt.getUTCDate())}`;
  return {
    name: `blitz-${day}-${pad(startsAt.getUTCHours())}00`,
    closesAt: new Date(startsAt.getTime() - BLITZ_SLOT_PREPARATION_SECONDS * 1000).toISOString(),
  };
};
