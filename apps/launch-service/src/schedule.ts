import { launchFailure } from "./errors";
import { BLITZ_SLOT_PREPARATION_SECONDS, blitzSlotFitsSeason } from "@realms-world/value-ledger";
import { Effect, Result } from "effect";
import { isRunning, type CalendarStore, type NextBlitzGame, type SeasonPhase } from "./calendar";
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
      // The next game opens at its tick: the timetable's next start, when it fits the window (`nextBlitzGame`).
      const slot = nextBlitzGame(calendarResult.success, now.getTime());
      if (slot && Date.parse(slot.opensAt) <= now.getTime())
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
const PREPARATION_MS = BLITZ_SLOT_PREPARATION_SECONDS * 1000;

/**
 * The timetable's slot starting at `startsAt`: its start names it. Its entry closes the preparation before its start,
 * and the schedule opens it at the tick that reaches it (`nextBlitzSlot`): when the start before it closes its entry.
 */
const slotStartingAt = (startsAt: number): NextBlitzGame => {
  const iso = new Date(startsAt).toISOString();
  return {
    name: `blitz-${iso.slice(0, 10).replaceAll("-", "")}-${iso.slice(11, 16).replace(":", "")}`,
    startsAt: iso,
    closesAt: new Date(startsAt - PREPARATION_MS).toISOString(),
    opensAt: new Date(startsAt - BLITZ_SLOT_INTERVAL_MS - PREPARATION_MS).toISOString(),
  };
};

/** The next timetable start whose registration is still open; its start time also names the slot. */
const nextBlitzSlot = (now: Date): NextBlitzGame =>
  slotStartingAt((Math.floor((now.getTime() + PREPARATION_MS) / BLITZ_SLOT_INTERVAL_MS) + 1) * BLITZ_SLOT_INTERVAL_MS);

/**
 * The next Blitz game the schedule will open, as the cron tick decides it: the first timetable start from now whose
 * preparation, play and settlement fit inside the Blitz window. Null when the calendar has no Blitz window, or none of
 * its starts is left.
 */
export const nextBlitzGame = (phases: readonly SeasonPhase[], now: number): NextBlitzGame | null => {
  const blitz = phases.find(({ phase }) => phase === "blitz");
  if (!blitz) return null;
  const end = Date.parse(blitz.endsAt);
  for (let slot = nextBlitzSlot(new Date(now)); Date.parse(slot.closesAt) < end; ) {
    if (fitsInside(blitz, slot.closesAt)) return slot;
    slot = slotStartingAt(Date.parse(slot.startsAt) + BLITZ_SLOT_INTERVAL_MS);
  }
  return null;
};
