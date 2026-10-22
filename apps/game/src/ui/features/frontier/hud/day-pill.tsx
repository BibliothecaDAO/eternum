import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudPill } from "@/ui/design-system/kit/hud-elements";
import { DAY, dayEnds, dayLeft, phraseText, TODAY, tomorrowLasts } from "@/ui/design-system/kit/words";
import { ClockSpent, useGameFinished } from "@/ui/features/world/containers/top-header/game-clock";
import { GameFinishedPill } from "@/ui/features/world/containers/top-header/game-finished-pill";
import type { ExpeditionRules } from "@bibliothecadao/eternum";

import { dayClock, type DayClock } from "./day-clock";
import { STORE_TONES } from "./status-strip";

/**
 * Frontier's clock in the top bar, its one day timer: today on the season's calendar, which opens Today, the day's
 * report (the owner, 22 October: "The day opening up the report is great"), or the finished game's pill.
 */
export const FrontierDayClock = ({ rules, onOpenToday }: { rules: ExpeditionRules; onOpenToday: () => void }) => {
  const clock = dayClock(rules, useNowSeconds());
  const finished = useGameFinished();
  if (finished) return <GameFinishedPill />;
  return (
    <button type="button" aria-label={TODAY} onClick={onOpenToday} className="pointer-events-auto rounded-full">
      <DayPill clock={clock} />
    </button>
  );
};

/**
 * Today as the top bar reads it: "Day 5 | 7h 14m left", in the day's tone (ember in its last hour), with a hairline of
 * the day spent; its hover says when it ends and how long tomorrow lasts. A dash before the season's first day.
 */
export const DayPill = ({ clock }: { clock: DayClock }) => (
  <HudPill
    label="Day clock"
    role="timer"
    data-tip={`${phraseText(dayEnds(clock.endsAt))} · ${phraseText(tomorrowLasts(clock.tomorrowSeconds))}`}
    className={cn("pointer-events-auto relative overflow-hidden tabular-nums", STORE_TONES[clock.tone].text)}
  >
    {[
      <span key="day" className="flex items-center gap-1.5 whitespace-nowrap">
        <SemanticIcon name="clock" className="h-4 w-4 shrink-0" />
        {DAY} {clock.day ?? "—"}
      </span>,
      <span key="left" className="whitespace-nowrap">
        {phraseText(dayLeft(clock.secondsLeft))}
        {clock.shareLeft !== undefined && <ClockSpent label="Day spent" share={1 - clock.shareLeft} />}
      </span>,
    ]}
  </HudPill>
);
