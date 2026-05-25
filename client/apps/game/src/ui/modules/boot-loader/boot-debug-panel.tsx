import { useEffect, useState } from "react";

import {
  GAME_ENTRY_TIMELINE_EVENT_NAME,
  getGameEntryTimelineSnapshot,
  type GameEntryTimelineSnapshot,
} from "@/ui/layouts/game-entry-timeline";

const TICK_INTERVAL_MS = 250;

/**
 * Subscribes to the game-entry timeline (milestone events + recorded durations)
 * and re-renders on every milestone plus a slow tick so the elapsed counter
 * stays live even between milestones. The snapshot is read on each tick so
 * `recordGameEntryDuration` writes (made by network helpers) surface here too
 * without their own event channel.
 */
const useBootTimelineSnapshot = (): GameEntryTimelineSnapshot => {
  const [snapshot, setSnapshot] = useState<GameEntryTimelineSnapshot>(() => getGameEntryTimelineSnapshot());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refresh = () => setSnapshot(getGameEntryTimelineSnapshot());

    refresh();
    const handleMilestone = () => refresh();
    window.addEventListener(GAME_ENTRY_TIMELINE_EVENT_NAME, handleMilestone as EventListener);
    const intervalId = window.setInterval(refresh, TICK_INTERVAL_MS);

    return () => {
      window.removeEventListener(GAME_ENTRY_TIMELINE_EVENT_NAME, handleMilestone as EventListener);
      window.clearInterval(intervalId);
    };
  }, []);

  return snapshot;
};

const formatMs = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
};

const computeStepDurations = (
  milestones: GameEntryTimelineSnapshot["milestones"],
): ReadonlyArray<{ name: string; elapsedMs: number; deltaMs: number }> => {
  const result: { name: string; elapsedMs: number; deltaMs: number }[] = [];
  let previousElapsed = 0;
  for (const milestone of milestones) {
    result.push({
      name: milestone.name,
      elapsedMs: milestone.elapsedMs,
      deltaMs: milestone.elapsedMs - previousElapsed,
    });
    previousElapsed = milestone.elapsedMs;
  }
  return result;
};

interface BootDebugPanelProps {
  currentTaskLabel?: string | null;
  /** Slow-step heuristic: any step longer than this is highlighted as the likely bottleneck. */
  slowThresholdMs?: number;
}

export const BootDebugPanel = ({ currentTaskLabel, slowThresholdMs = 1500 }: BootDebugPanelProps) => {
  const snapshot = useBootTimelineSnapshot();
  const steps = computeStepDurations(snapshot.milestones);
  const lastMilestone = steps.length > 0 ? steps[steps.length - 1] : null;
  const slowestStep = steps.reduce<(typeof steps)[number] | null>(
    (acc, step) => (acc === null || step.deltaMs > acc.deltaMs ? step : acc),
    null,
  );
  const sinceLastMilestoneMs =
    snapshot.elapsedMs !== null && lastMilestone !== null ? snapshot.elapsedMs - lastMilestone.elapsedMs : null;
  const durationEntries = Object.entries(snapshot.durations).sort(([, a], [, b]) => b - a);

  return (
    <div className="mx-auto mt-2 w-full max-w-[28rem] rounded-md border border-gold/15 bg-black/40 px-3 py-2 text-left font-mono text-[0.65rem] leading-snug text-gold/70">
      <div className="flex items-center justify-between gap-3 text-[0.7rem]">
        <span className="uppercase tracking-[0.2em] text-gold/50">debug</span>
        <span className="tabular-nums text-gold/85">
          {snapshot.elapsedMs === null ? "—" : `${formatMs(snapshot.elapsedMs)} elapsed`}
        </span>
      </div>

      <div className="mt-1 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-0.5">
        <span className="text-gold/40">phase</span>
        <span className="truncate text-gold/85">{currentTaskLabel ?? "—"}</span>

        <span className="text-gold/40">last milestone</span>
        <span className="truncate text-gold/85">
          {lastMilestone === null
            ? "—"
            : `${lastMilestone.name} (+${formatMs(lastMilestone.deltaMs)}, ${formatMs(lastMilestone.elapsedMs)} total)`}
        </span>

        <span className="text-gold/40">since last</span>
        <span
          className={
            sinceLastMilestoneMs !== null && sinceLastMilestoneMs > slowThresholdMs ? "text-red-300" : "text-gold/85"
          }
        >
          {sinceLastMilestoneMs === null ? "—" : `${formatMs(sinceLastMilestoneMs)} idle`}
        </span>

        <span className="text-gold/40">slowest step</span>
        <span className="truncate text-gold/85">
          {slowestStep === null ? "—" : `${slowestStep.name} (+${formatMs(slowestStep.deltaMs)})`}
        </span>
      </div>

      {durationEntries.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-gold/45">recorded durations ({durationEntries.length})</summary>
          <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
            {durationEntries.map(([name, ms]) => (
              <div key={name} className="contents">
                <span className="truncate text-gold/65">{name}</span>
                <span className={`tabular-nums ${ms > slowThresholdMs ? "text-red-300" : "text-gold/80"}`}>
                  {formatMs(ms)}
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {steps.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-gold/45">milestones ({steps.length})</summary>
          <div className="mt-1 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0.5">
            {steps.map((step) => (
              <div key={step.name} className="contents">
                <span className="truncate text-gold/65">{step.name}</span>
                <span className={`tabular-nums ${step.deltaMs > slowThresholdMs ? "text-red-300" : "text-gold/55"}`}>
                  +{formatMs(step.deltaMs)}
                </span>
                <span className="tabular-nums text-gold/35">{formatMs(step.elapsedMs)}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
};
