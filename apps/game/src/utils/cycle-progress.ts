export type DebugCycleProgressOverride = number | null;

const MIN_CYCLE_PROGRESS = 0;
const MAX_CYCLE_PROGRESS = 100;

export const clampCycleProgress = (progress: number): number => {
  if (!Number.isFinite(progress)) {
    return MIN_CYCLE_PROGRESS;
  }

  return Math.min(Math.max(progress, MIN_CYCLE_PROGRESS), MAX_CYCLE_PROGRESS);
};

export const resolveDebuggableCycleProgress = (
  liveProgress: number,
  debugOverride: DebugCycleProgressOverride,
): number => clampCycleProgress(debugOverride ?? liveProgress);

/** Six army ticks remain the renderer's day/night cycle; they are not HUD phases. */
export function resolveDayCycleProgress(timestamp: number, armyTickSeconds: number): number {
  if (!Number.isFinite(armyTickSeconds) || armyTickSeconds <= 0) throw new Error("Army tick duration is unavailable");
  const daySeconds = armyTickSeconds * 6;
  return ((timestamp % daySeconds) / daySeconds) * 100;
}

export const DAY_PHASE_PROGRESS = {
  dawn: 100 / 6,
  morning: 100 / 3,
  afternoon: 50,
  lateAfternoon: 175 / 3,
  dusk: (100 / 6) * 4,
  evening: (100 / 6) * 5,
} as const;

const DAY_PHASES = [
  { name: "Night", start: 0 },
  { name: "Dawn", start: DAY_PHASE_PROGRESS.dawn },
  { name: "Morning", start: DAY_PHASE_PROGRESS.morning },
  { name: "Day", start: DAY_PHASE_PROGRESS.afternoon },
  { name: "Afternoon", start: DAY_PHASE_PROGRESS.lateAfternoon },
  { name: "Dusk", start: DAY_PHASE_PROGRESS.dusk },
  { name: "Evening", start: DAY_PHASE_PROGRESS.evening },
];
export function resolveDayPhase(cycleProgress: number): { name: string; progress: number } {
  const cycle = clampCycleProgress(cycleProgress) % 100;
  const index = DAY_PHASES.findLastIndex((phase) => cycle >= phase.start);
  const phase = DAY_PHASES[index];
  const end = DAY_PHASES[index + 1]?.start ?? 100;
  return { name: phase.name, progress: ((cycle - phase.start) / (end - phase.start)) * 100 };
}
