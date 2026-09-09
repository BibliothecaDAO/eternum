import { DAY_PHASES, resolveDayPhase, type DayPhaseName } from "@/utils/cycle-progress";
import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { memo, useEffect } from "react";
import Clock from "lucide-react/dist/esm/icons/clock";
import Moon from "lucide-react/dist/esm/icons/moon";
import MoonStar from "lucide-react/dist/esm/icons/moon-star";
import Sun from "lucide-react/dist/esm/icons/sun";
import SunDim from "lucide-react/dist/esm/icons/sun-dim";
import Sunrise from "lucide-react/dist/esm/icons/sunrise";
import Sunset from "lucide-react/dist/esm/icons/sunset";
import { configManager } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { TOP_PILL } from "./top-pill";
import { GameFinishedPill } from "./game-finished-pill";
import { formatGameClockDuration, resolveGameClock } from "./game-clock-policy";

const URGENCY_CLASSES = ["urgency-border-warning", "urgency-border-critical", "urgency-border-final"];
const PHASE_ICONS: Record<DayPhaseName, typeof Sun> = {
  Night: Moon,
  Dawn: Sunrise,
  Morning: SunDim,
  Day: Sun,
  Dusk: Sunset,
  Evening: MoonStar,
};

export const GameClock = memo(() => {
  const dayPhase = resolveDayPhase(useUIStore((state) => state.cycleProgress));
  const startAt = useUIStore((state) => state.gameStartMainAt);
  const endAt = useUIStore((state) => state.gameEndAt);
  const now = useCurrentBlockTimestamp();
  const armyTickSeconds = configManager.getTick(TickIds.Armies);
  const clock = resolveGameClock({ startAt, endAt, now, armyTickSeconds });
  const remaining = clock.phase === "live" && endAt ? endAt - now : Infinity;
  const urgency = remaining <= 30 ? "final" : remaining <= 120 ? "critical" : remaining <= 300 ? "warning" : null;
  useEffect(() => {
    document.body.classList.remove(...URGENCY_CLASSES);
    if (urgency) document.body.classList.add(`urgency-border-${urgency}`);
    return () => document.body.classList.remove(...URGENCY_CLASSES);
  }, [urgency]);
  if (clock.phase === "finished") return <GameFinishedPill />;
  const PhaseIcon = PHASE_ICONS[dayPhase.name];
  const phaseSecondsLeft = Math.round(((100 - dayPhase.progress) / 100) * armyTickSeconds);
  const breakdown = [
    `${dayPhase.name} · phase ${dayPhase.index + 1} of ${DAY_PHASES.length}`,
    `Day length ${formatGameClockDuration(armyTickSeconds * DAY_PHASES.length)}`,
    `${formatGameClockDuration(phaseSecondsLeft)} left in ${dayPhase.name.toLowerCase()}`,
  ].join("\n");
  return (
    <div className={cn(TOP_PILL, "relative overflow-hidden")} aria-label="Game clock" title={breakdown}>
      <Clock className="h-3.5 w-3.5" />
      <span className={cn(HUD_LABEL_BRIGHT, "whitespace-nowrap")}>{clock.label}</span>
      <span aria-hidden className="h-4 w-px bg-gold/25" />
      <PhaseIcon className="h-3.5 w-3.5" aria-label={dayPhase.name} />
      <span className={cn(HUD_LABEL_BRIGHT, "whitespace-nowrap tabular-nums")}>
        {formatGameClockDuration(phaseSecondsLeft)}
      </span>
      {clock.remainingRatio !== null && (
        <div
          role="progressbar"
          aria-label={`${dayPhase.name} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(dayPhase.progress)}
          className="absolute bottom-0 left-0 right-0 flex h-0.5 gap-px"
        >
          {DAY_PHASES.map((phase, index) => (
            <span key={phase.name} className="relative flex-1 bg-gold/20">
              {index < dayPhase.index && <span className="absolute inset-0 bg-gold/60" />}
              {index === dayPhase.index && (
                <span
                  className="absolute inset-y-0 left-0 bg-gold"
                  style={{ width: `${Math.round(dayPhase.progress)}%` }}
                />
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
GameClock.displayName = "GameClock";
