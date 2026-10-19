import { useFactView } from "@/hooks/use-fact-view";
import { seasonClockView } from "@/sync/fact-views";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { memo, useEffect } from "react";

import { configManager } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudPill } from "@/ui/design-system/kit/hud-elements";
import { GameFinishedPill } from "./game-finished-pill";
import { resolveGameClock } from "./game-clock-policy";

/** The game's clock as the top bar reads it: its phase (not started, live, finished), its end and now. */
const useGameClockReading = () => {
  const { gameStartMainAt: startAt, gameEndAt: endAt } = useFactView(seasonClockView);
  const now = useCurrentBlockTimestamp();
  const armyTickSeconds = configManager.getTick(TickIds.Armies);
  const clock = resolveGameClock({ startAt, endAt, now, armyTickSeconds, gameOver: configManager.isGameOver() });
  return { clock, endAt, now };
};

/** Whether the game has finished, as the top bar's clock says it (its Game finished pill). */
export const useGameFinished = (): boolean => useGameClockReading().clock.phase === "finished";

const URGENCY_CLASSES = ["urgency-border-warning", "urgency-border-critical", "urgency-border-final"];

/**
 * The game's time left, with a hairline of the game spent. No rule reads the time of day (the renderer's six-tick day
 * only lights the scene), so the clock carries no day phase.
 */
export const GameClock = memo(({ compact = false }: { compact?: boolean }) => {
  const { clock, endAt, now } = useGameClockReading();
  const remaining = clock.phase === "live" && endAt ? endAt - now : Infinity;
  const urgency = remaining <= 30 ? "final" : remaining <= 120 ? "critical" : remaining <= 300 ? "warning" : null;
  useEffect(() => {
    document.body.classList.remove(...URGENCY_CLASSES);
    if (urgency) document.body.classList.add(`urgency-border-${urgency}`);
    return () => document.body.classList.remove(...URGENCY_CLASSES);
  }, [urgency]);
  if (clock.phase === "finished") return <GameFinishedPill />;
  return (
    <HudPill
      label="Game clock"
      title={compact ? clock.label : undefined}
      className={cn("pointer-events-auto relative overflow-hidden", compact && "px-2")}
    >
      {[
        <span key="time" className="flex items-center gap-1.5" aria-label={compact ? clock.label : undefined}>
          <SemanticIcon name="hourglass" className="h-3.5 w-3.5 shrink-0" />
          <span className={cn("whitespace-nowrap tabular-nums", compact && "text-hud-label")}>
            {compact ? clock.compactLabel : clock.label}
          </span>
          {clock.remainingRatio !== null && <GameSpent share={1 - clock.remainingRatio} />}
        </span>,
      ]}
    </HudPill>
  );
});
GameClock.displayName = "GameClock";

/** The game spent, as a hairline along the clock's foot. */
const GameSpent = ({ share }: { share: number }) => (
  <div
    role="progressbar"
    aria-label="Game spent"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(share * 100)}
    className="absolute bottom-0 left-0 right-0 h-0.5 bg-hud-divider"
  >
    <span className="absolute inset-y-0 left-0 bg-hud-accent" style={{ width: `${Math.round(share * 100)}%` }} />
  </div>
);
