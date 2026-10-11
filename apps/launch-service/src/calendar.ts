import { frontierBaseConfig } from "../../../config/source/frontier/base";
import { frontierPreset } from "../../../config/source/frontier/native";
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

export interface CalendarStore {
  list(): Promise<SeasonPhase[]>;
  /** Sets a phase's dates: a phase not running moves freely; a running one keeps its start, and Frontier its end. */
  set(phase: SeasonPhase, now: number): Promise<SeasonPhase>;
}

export class CalendarConflict extends Error {}

const FRONTIER_BAG_MS = seasonSeconds(1, frontierPreset.dayUnitSeconds) * 1_000;
const FRONTIER_TICK_MS = (frontierBaseConfig.tick?.armiesTickIntervalInSeconds ?? 0) * 1_000;

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
