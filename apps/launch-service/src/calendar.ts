import { DAYS_PER_BAG, seasonSeconds } from "../../../packages/core/src/utils/days";
import { frontierSeasonOnePreset } from "../../../config/source/frontier/season-one";
import { seasonDayUnitSeconds } from "../../../config/source/common/season-clock";
import { FRONTIER_ARMIES_TICK_SECONDS } from "../../../config/source/frontier/clock";

/**
 * The season calendar: when each phase of the season runs. The operator sets each phase's start and end, and the cron tick
 * reads them. Frontier season boundaries align to army ticks.
 */
export type SeasonPhaseName = "frontier";

interface PhaseDates {
  startsAt: string;
  endsAt: string;
}

export type FrontierSeasonPhase = PhaseDates & { phase: "frontier" };
export type SeasonPhase = FrontierSeasonPhase;

export interface CalendarStore {
  list(): Promise<SeasonPhase[]>;
  set(phase: SeasonPhase, now: number): Promise<SeasonPhase>;
}

export class CalendarConflict extends Error {}

export const PHASE_END_ERROR = "A phase must end in the future";

export const assertFrontierSeason = (startsAt: number, endsAt: number) => {
  const preset = frontierSeasonOnePreset;
  const tickMs = FRONTIER_ARMIES_TICK_SECONDS * 1_000;
  if (tickMs <= 0) throw new Error("Frontier has no armies tick");
  if (![startsAt, endsAt].every(Number.isSafeInteger)) throw new CalendarConflict("Invalid season dates");
  if (startsAt % tickMs !== 0) throw new CalendarConflict(`A Frontier season starts on a ${tickMs / 1_000} s tick`);
  if (endsAt <= startsAt) throw new CalendarConflict("A Frontier season must end after it starts");
  if (endsAt % tickMs !== 0) throw new CalendarConflict(`A Frontier season ends on a ${tickMs / 1_000} s tick`);
  const limit = seasonSeconds(preset.race.seasonDays / DAYS_PER_BAG, seasonDayUnitSeconds(preset)) * 1_000;
  if (endsAt - startsAt > limit) throw new CalendarConflict("Race exceeds the season day limit");
};

/** Whether the phase is running at this instant: from its start, up to but not including its end. */
export const isRunning = (phase: SeasonPhase, at: number) =>
  Date.parse(phase.startsAt) <= at && at < Date.parse(phase.endsAt);
