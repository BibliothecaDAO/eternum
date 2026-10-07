import { frontierBaseConfig } from "../../../config/source/frontier/base";
import { frontierPreset } from "../../../config/source/frontier/native";
import { seasonSeconds } from "../../../packages/core/src/utils/days";

/**
 * The season calendar: when each phase of the season runs. Launchers set each phase's start and end, and the cron tick
 * reads them; a Frontier season's length is its preset's.
 */
export type SeasonPhaseName = "frontier" | "blitz";

export interface SeasonPhase {
  phase: SeasonPhaseName;
  startsAt: string;
  endsAt: string;
}

export interface CalendarStore {
  list(): Promise<SeasonPhase[]>;
  /** Sets a phase's dates: a phase not running moves freely; a running one keeps its start, and Frontier its end. */
  set(phase: SeasonPhase, now: number): Promise<SeasonPhase>;
}

export class CalendarConflict extends Error {}

const FRONTIER_SEASON_MS = seasonSeconds(frontierPreset.seasonBags, frontierPreset.dayUnitSeconds) * 1_000;
const FRONTIER_TICK_MS = (frontierBaseConfig.tick?.armiesTickIntervalInSeconds ?? 0) * 1_000;

/** A Frontier season starts on an armies tick and lasts its preset's bags of days exactly, as its game must. */
export const assertFrontierSeason = (startsAt: number, endsAt: number) => {
  if (FRONTIER_TICK_MS <= 0) throw new Error("Frontier has no armies tick");
  if (startsAt % FRONTIER_TICK_MS !== 0 || endsAt - startsAt !== FRONTIER_SEASON_MS)
    throw new CalendarConflict(
      `A Frontier season starts on a ${FRONTIER_TICK_MS / 1_000} s tick and lasts ${frontierPreset.seasonBags} bags of days, ${FRONTIER_SEASON_MS / 3_600_000} hours`,
    );
};

/** Whether the phase is running at this instant: from its start, up to but not including its end. */
export const isRunning = (phase: SeasonPhase, at: number) =>
  Date.parse(phase.startsAt) <= at && at < Date.parse(phase.endsAt);
