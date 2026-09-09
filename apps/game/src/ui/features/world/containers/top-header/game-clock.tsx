import { resolveDayPhase } from "@/utils/cycle-progress";
import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { memo, useEffect } from "react";
import Clock from "lucide-react/dist/esm/icons/clock";
import { configManager } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { TOP_PILL } from "./top-pill";
import { GameFinishedPill } from "./game-finished-pill";
import { resolveGameClock } from "./game-clock-policy";

const URGENCY_CLASSES = ["urgency-border-warning", "urgency-border-critical", "urgency-border-final"];
export const GameClock = memo(() => {
  const dayPhase = resolveDayPhase(useUIStore((state) => state.cycleProgress));
  const startAt = useUIStore((state) => state.gameStartMainAt);
  const endAt = useUIStore((state) => state.gameEndAt);
  const now = useCurrentBlockTimestamp();
  const clock = resolveGameClock({ startAt, endAt, now, armyTickSeconds: configManager.getTick(TickIds.Armies) });
  const remaining = clock.phase === "live" && endAt ? endAt - now : Infinity;
  const urgency = remaining <= 30 ? "final" : remaining <= 120 ? "critical" : remaining <= 300 ? "warning" : null;
  useEffect(() => {
    document.body.classList.remove(...URGENCY_CLASSES);
    if (urgency) document.body.classList.add(`urgency-border-${urgency}`);
    return () => document.body.classList.remove(...URGENCY_CLASSES);
  }, [urgency]);
  if (clock.phase === "finished") return <GameFinishedPill />;
  return (
    <div className={cn(TOP_PILL, "relative overflow-hidden")} aria-label="Game clock" title={dayPhase.name}>
      <Clock className="h-3.5 w-3.5" />
      <span className={cn(HUD_LABEL_BRIGHT, "whitespace-nowrap")}>{clock.label}</span>
      {clock.remainingRatio !== null && (
        <div
          role="progressbar"
          aria-label={`${dayPhase.name} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(dayPhase.progress)}
          className="absolute bottom-0 left-0 h-0.5 bg-gold"
          style={{ width: `${dayPhase.progress}%` }}
        />
      )}
    </div>
  );
});
GameClock.displayName = "GameClock";
