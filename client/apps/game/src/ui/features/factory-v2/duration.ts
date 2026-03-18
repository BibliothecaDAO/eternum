import type { FactoryDurationOption, FactoryGameMode, FactoryLaunchPreset } from "./types";

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

const BLITZ_DURATION_PRESETS = [MINUTES_PER_HOUR, 90, 2 * MINUTES_PER_HOUR, 5 * MINUTES_PER_DAY];

export const formatFactoryDurationLabel = (durationMinutes: number) => {
  if (durationMinutes % MINUTES_PER_DAY === 0) {
    const dayCount = durationMinutes / MINUTES_PER_DAY;
    return `${dayCount} day${dayCount === 1 ? "" : "s"}`;
  }

  if (durationMinutes % MINUTES_PER_HOUR === 0) {
    const hourCount = durationMinutes / MINUTES_PER_HOUR;
    return `${hourCount}h`;
  }

  if (durationMinutes > MINUTES_PER_HOUR) {
    const hourCount = Math.floor(durationMinutes / MINUTES_PER_HOUR);
    const minuteCount = durationMinutes % MINUTES_PER_HOUR;
    return `${hourCount}h ${minuteCount}m`;
  }

  return `${durationMinutes}m`;
};

export const supportsFactoryDuration = (mode: FactoryGameMode) => mode === "blitz";

export const buildBlitzDurationOptions = (
  presets: FactoryLaunchPreset[],
  selectedDurationMinutes: number | null,
): FactoryDurationOption[] => {
  const durationMinutes = Array.from(
    new Set(
      [...BLITZ_DURATION_PRESETS, ...presets.map((preset) => preset.defaults.durationMinutes), selectedDurationMinutes].filter(
        (value): value is number => typeof value === "number",
      ),
    ),
  );

  return durationMinutes.sort((left, right) => left - right).map((value) => ({
    value,
    label: formatFactoryDurationLabel(value),
  }));
};
