import { nativePresets } from "../../../config/source/native";
import { clockScaled, seasonDayUnitSeconds } from "../../../config/source/common/season-clock";
import { FRONTIER_ARMIES_TICK_SECONDS } from "../../../config/source/frontier/clock";
import { seasonSeconds } from "../../../packages/core/src/utils/days";

/**
 * The season calendar: when each phase of the season runs. The operator sets each phase's start and end, and the cron tick
 * reads them. A Frontier season ends on a complete bag of seeded days.
 */
export type SeasonPhaseName = "frontier" | "blitz";

interface PhaseDates {
  startsAt: string;
  endsAt: string;
}

export type FrontierSeasonPhase = PhaseDates & { phase: "frontier"; presetId: number };
export type SeasonPhase = FrontierSeasonPhase | (PhaseDates & { phase: "blitz"; presetId?: never });

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
  /** Sets dates and Frontier's preset; a running or queued Frontier season retains its identity. */
  set(phase: SeasonPhase, now: number): Promise<SeasonPhase>;
}

export class CalendarConflict extends Error {}

export const PHASE_END_ERROR = "A phase must end in the future";

/** A Frontier season starts on an armies tick and contains a positive whole number of bags. */
export const assertFrontierSeason = (startsAt: number, endsAt: number, presetId: number) => {
  const preset = nativePresets[presetId];
  if (!Number.isSafeInteger(presetId) || !preset || preset.gameType !== "frontier")
    throw new CalendarConflict("Select a registered Frontier preset");
  const scale = preset.clockScale?.activity ?? 1;
  const bagMs = seasonSeconds(1, seasonDayUnitSeconds(preset)) * 1_000;
  const tickMs = clockScaled(FRONTIER_ARMIES_TICK_SECONDS, scale, "armies_tick") * 1_000;
  if (tickMs <= 0) throw new Error("Frontier has no armies tick");
  if (![startsAt, endsAt].every(Number.isSafeInteger)) throw new CalendarConflict("Invalid season dates");
  if (startsAt % tickMs !== 0) throw new CalendarConflict(`A Frontier season starts on a ${tickMs / 1_000} s tick`);
  const duration = endsAt - startsAt;
  if (duration > 0 && duration % bagMs === 0) return;
  const lowerBags = Math.max(1, Math.floor(duration / bagMs));
  const lowerEnd = new Date(startsAt + lowerBags * bagMs).toISOString();
  const upperEnd = new Date(startsAt + (lowerBags + 1) * bagMs).toISOString();
  throw new CalendarConflict(
    `A Frontier season lasts whole bags of days; nearest valid ends: ${lowerEnd}, ${upperEnd}`,
  );
};

/** Whether the phase is running at this instant: from its start, up to but not including its end. */
export const isRunning = (phase: SeasonPhase, at: number) =>
  Date.parse(phase.startsAt) <= at && at < Date.parse(phase.endsAt);
