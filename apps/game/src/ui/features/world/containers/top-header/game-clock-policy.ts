import { formatGameClock } from "@bibliothecadao/types";
import { hasFiniteSeasonEnd } from "@/ui/features/world/utils/season-timing";

export function resolveGameClock({
  startAt,
  endAt,
  now,
  armyTickSeconds,
  gameOver,
}: {
  startAt: number | null;
  endAt: number | null;
  now: number;
  armyTickSeconds: number;
  /** The registry's one answer to "is the season over", closed early or past its end. */
  gameOver: boolean;
}) {
  if (!Number.isFinite(now) || now <= 0 || !hasFiniteSeasonEnd(startAt)) {
    return {
      phase: "unavailable",
      label: "Clock unavailable",
      compactLabel: "Clock unavailable",
      remainingRatio: null,
    } as const;
  }
  if (now < startAt)
    return {
      phase: "before",
      label: `Starts in ${formatGameClock(startAt - now)}`,
      compactLabel: `Starts in ${formatGameClock(startAt - now, { compact: true })}`,
      remainingRatio: null,
    } as const;
  if (!hasFiniteSeasonEnd(endAt))
    return { phase: "live", label: "No time limit", compactLabel: "No time limit", remainingRatio: null } as const;
  if (gameOver)
    return { phase: "finished", label: "Game finished", compactLabel: "Game finished", remainingRatio: null } as const;
  if (!Number.isFinite(armyTickSeconds) || armyTickSeconds <= 0) throw new Error("Army tick duration is unavailable");
  const startTick = Math.floor(startAt / armyTickSeconds);
  const totalTicks = Math.max(1, Math.ceil(endAt / armyTickSeconds) - startTick);
  const elapsedTicks = Math.floor(now / armyTickSeconds) - startTick;
  return {
    phase: "live",
    label: `${formatGameClock(endAt - now)} left`,
    compactLabel: `${formatGameClock(endAt - now, { compact: true })} left`,
    remainingRatio: Math.max(0, 1 - elapsedTicks / totalTicks),
  } as const;
}
