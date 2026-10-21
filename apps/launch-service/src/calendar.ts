import { FRONTIER_ARMIES_TICK_SECONDS, FRONTIER_DAY_UNIT_SECONDS } from "../../../config/source/frontier/clock";
import { seasonSeconds } from "../../../packages/core/src/utils/days";

/**
 * The season calendar: when each phase of the season runs. The operator sets each phase's start and end, and the cron tick
 * reads them. A Frontier season ends on a complete bag of seeded days.
 */
export type SeasonPhaseName = "frontier" | "blitz";

export interface SeasonPhase {
  phase: SeasonPhaseName;
  startsAt: string;
  endsAt: string;
}

/**
 * The next Blitz game the schedule opens (`nextBlitzGame`, schedule.ts): its slot's name, its start, when its entry
 * closes, and when the schedule opens it for entry, every one an ISO instant. The client shows it until it is opened.
 */
export interface NextBlitzGame {
  name: string;
  startsAt: string;
  closesAt: string;
  opensAt: string;
}

export interface CalendarStore {
  list(): Promise<SeasonPhase[]>;
  /** Sets a phase's dates: a phase not running moves freely; a running one keeps its start, and Frontier its end. */
  set(phase: SeasonPhase, now: number): Promise<SeasonPhase>;
}

export class CalendarConflict extends Error {}

export const PHASE_END_ERROR = "A phase must end in the future";

const FRONTIER_BAG_MS = seasonSeconds(1, FRONTIER_DAY_UNIT_SECONDS) * 1_000;
const FRONTIER_TICK_MS = FRONTIER_ARMIES_TICK_SECONDS * 1_000;

/** A Frontier season starts on an armies tick and contains a positive whole number of bags. */
export const assertFrontierSeason = (startsAt: number, endsAt: number) => {
  if (FRONTIER_TICK_MS <= 0) throw new Error("Frontier has no armies tick");
  if (![startsAt, endsAt].every(Number.isSafeInteger)) throw new CalendarConflict("Invalid season dates");
  if (startsAt % FRONTIER_TICK_MS !== 0)
    throw new CalendarConflict(`A Frontier season starts on a ${FRONTIER_TICK_MS / 1_000} s tick`);
  const duration = endsAt - startsAt;
  if (duration > 0 && duration % FRONTIER_BAG_MS === 0) return;
  const lowerBags = Math.max(1, Math.floor(duration / FRONTIER_BAG_MS));
  const lowerEnd = new Date(startsAt + lowerBags * FRONTIER_BAG_MS).toISOString();
  const upperEnd = new Date(startsAt + (lowerBags + 1) * FRONTIER_BAG_MS).toISOString();
  throw new CalendarConflict(
    `A Frontier season lasts whole bags of days; nearest valid ends: ${lowerEnd}, ${upperEnd}`,
  );
};

/** Whether the phase is running at this instant: from its start, up to but not including its end. */
export const isRunning = (phase: SeasonPhase, at: number) =>
  Date.parse(phase.startsAt) <= at && at < Date.parse(phase.endsAt);
