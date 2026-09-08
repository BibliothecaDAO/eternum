import { hasFiniteSeasonEnd } from "@/ui/features/world/utils/season-timing";

export function resolveGameClock({
  startAt,
  endAt,
  now,
  armyTickSeconds,
}: {
  startAt: number | null;
  endAt: number | null;
  now: number;
  armyTickSeconds: number;
}) {
  if (!Number.isFinite(now) || now <= 0 || !hasFiniteSeasonEnd(startAt)) {
    return { phase: "unavailable", label: "Clock unavailable", remainingRatio: null } as const;
  }
  if (now < startAt)
    return {
      phase: "before",
      label: `Starts in ${formatGameClockDuration(startAt - now)}`,
      remainingRatio: null,
    } as const;
  if (!hasFiniteSeasonEnd(endAt)) return { phase: "live", label: "No time limit", remainingRatio: null } as const;
  if (now >= endAt) return { phase: "finished", label: "Game finished", remainingRatio: null } as const;
  if (!Number.isFinite(armyTickSeconds) || armyTickSeconds <= 0) throw new Error("Army tick duration is unavailable");
  const startTick = Math.floor(startAt / armyTickSeconds);
  const totalTicks = Math.max(1, Math.ceil(endAt / armyTickSeconds) - startTick);
  const elapsedTicks = Math.floor(now / armyTickSeconds) - startTick;
  return {
    phase: "live",
    label: `${formatGameClockDuration(endAt - now)} left`,
    remainingRatio: Math.max(0, 1 - elapsedTicks / totalTicks),
  } as const;
}

export const formatGameClockDuration = (secondsUntilStart: number): string => {
  const total = Math.max(0, Math.floor(secondsUntilStart));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  const minuteSecondLabel = `${minutes}m ${seconds.toString().padStart(2, "0")}s`;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, "0")}h ${minuteSecondLabel}`;
  }

  if (hours > 0) {
    return `${hours}h ${minuteSecondLabel}`;
  }

  return minuteSecondLabel;
};
