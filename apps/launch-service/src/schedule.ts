import { launchFailure } from "./errors";
import { Effect, Result } from "effect";
import { isRunning, type CalendarStore, type FrontierSeasonPhase } from "./calendar";
import { frontierSeasonRequest } from "./schemas";
import { databaseOperation, type LaunchServiceStore } from "./store";

export const runLaunchSchedule = (store: LaunchServiceStore, calendar: CalendarStore) =>
  Effect.gen(function* () {
    const now = new Date(Date.now());
    const calendarResult = yield* Effect.result(databaseOperation("read the season calendar", () => calendar.list()));
    if (Result.isSuccess(calendarResult)) {
      const frontier = calendarResult.success.find((entry) => entry.phase === "frontier");
      if (frontier && isRunning(frontier, now.getTime()))
        yield* runScheduleStep("schedule frontier season", () => scheduleFrontierSeason(store, frontier));
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

/**
 * The season is created once, whatever becomes of its run, so a tick never resets a launch in progress; a season whose
 * launch failed is continued only by the operator.
 */
export const scheduleFrontierSeason = (store: LaunchServiceStore, season: FrontierSeasonPhase) =>
  store.schedule(frontierSeasonRequest(season));
