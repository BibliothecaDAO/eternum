import { launchFailure } from "./errors";
import { BLITZ_SLOT_PREPARATION_SECONDS, blitzSlotFitsSeason } from "@realms-world/value-ledger";
import { Effect, Result } from "effect";
import { isRunning, type CalendarStore, type SeasonPhase } from "./calendar";
import { frontierSeasonRequest } from "./schemas";
import { blitzSlotWindow, type SlotStore } from "./slots";
import { databaseOperation, type LaunchServiceStore } from "./store";

/**
 * One cron tick, read from the season calendar: the Frontier season game exists once its season has started, and the
 * next Blitz slot exists when preparation, play and settlement fit inside the Blitz window. The registrar freezes
 * it at its close and launches it from that one read of the ledger. Every step is idempotent, so overlapping ticks agree.
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
      if (blitz && fitsInside(blitz, slot.closesAt))
        yield* runScheduleStep("schedule blitz slot", () => slots.create(slot.name, slot.closesAt));
    } else {
      console.error("launch_schedule_step_failed", {
        operation: "read the season calendar",
        ...launchFailure(calendarResult.failure),
      });
    }
  });

const runScheduleStep = <A>(operation: string, task: () => Promise<A>) =>
  Effect.gen(function* () {
    const result = yield* Effect.result(databaseOperation(operation, task));
    if (Result.isFailure(result))
      console.error("launch_schedule_step_failed", { operation, ...launchFailure(result.failure) });
  });

const fitsInside = (season: SeasonPhase, closesAt: string) => {
  const slot = blitzSlotWindow(closesAt);
  return blitzSlotFitsSeason(slot.start, slot.end, {
    start: Date.parse(season.startsAt) / 1000,
    end: Date.parse(season.endsAt) / 1000,
  });
};

/**
 * The season is created once, whatever becomes of its run, so a tick never resets a launch in progress; a season whose
 * launch failed is continued only by the operator.
 */
export const scheduleFrontierSeason = (store: LaunchServiceStore, season: SeasonPhase) =>
  store.schedule("game", frontierSeasonRequest(season));

/** Ninety minutes divides the UTC day: 00:00, 01:30, ... 22:30. */
const BLITZ_SLOT_INTERVAL_MS = 90 * 60 * 1000;

/** The next timetable start whose registration is still open; its start time also names the slot. */
const nextBlitzSlot = (now: Date): { name: string; closesAt: string } => {
  const after = now.getTime() + BLITZ_SLOT_PREPARATION_SECONDS * 1000;
  const startsAt = new Date((Math.floor(after / BLITZ_SLOT_INTERVAL_MS) + 1) * BLITZ_SLOT_INTERVAL_MS);
  const iso = startsAt.toISOString();
  return {
    name: `blitz-${iso.slice(0, 10).replaceAll("-", "")}-${iso.slice(11, 16).replace(":", "")}`,
    closesAt: new Date(startsAt.getTime() - BLITZ_SLOT_PREPARATION_SECONDS * 1000).toISOString(),
  };
};
