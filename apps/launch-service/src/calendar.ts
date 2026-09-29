/**
 * The season calendar: when each phase of the season runs. Nothing is derived from a fixed cycle length; launchers set
 * each phase's start and end, and the cron tick reads them.
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

/** Whether the phase is running at this instant: from its start, up to but not including its end. */
export const isRunning = (phase: SeasonPhase, at: number) =>
  Date.parse(phase.startsAt) <= at && at < Date.parse(phase.endsAt);
