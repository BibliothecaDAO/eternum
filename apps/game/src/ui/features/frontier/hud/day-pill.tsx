import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { DAY_MEDALLION } from "@/ui/design-system/icon-meaning";
import {
  DAY,
  dayEnds,
  dayLeft,
  dayLeftCompact,
  LEFT,
  phraseText,
  TODAY,
  tomorrowLasts,
} from "@/ui/design-system/kit/words";
import { useGameFinished } from "@/ui/features/world/containers/top-header/game-clock";
import { GameFinishedPill } from "@/ui/features/world/containers/top-header/game-finished-pill";
import type { ExpeditionRules } from "@bibliothecadao/eternum";

import { dayClock, dayElapsedShare, type DayClock } from "./day-clock";
import { ProgressRing } from "./progress-ring";
import { STORE_TONES } from "./status-strip";

const dayTip = (clock: DayClock): string => {
  const left = dayLeftCompact(clock.secondsLeft);
  return [
    phraseText(dayEnds(clock.endsAt)),
    left ? phraseText(dayLeft(clock.secondsLeft)) : undefined,
    clock.tomorrowSeconds !== undefined ? phraseText(tomorrowLasts(clock.tomorrowSeconds)) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
};

export const FrontierDayClock = ({
  rules,
  compact = false,
  onOpenToday,
}: {
  rules: ExpeditionRules;
  compact?: boolean;
  onOpenToday: () => void;
}) => {
  const clock = dayClock(rules, useNowSeconds());
  const finished = useGameFinished();
  if (finished) return <GameFinishedPill />;
  return (
    <button type="button" aria-label={TODAY} onClick={onOpenToday} className="frontier-day-trigger pointer-events-auto">
      {compact ? <DayRing clock={clock} /> : <DayMedallion clock={clock} />}
    </button>
  );
};

export const DayRing = ({ clock }: { clock: DayClock }) => {
  const left = dayLeftCompact(clock.secondsLeft);
  const tip = dayTip(clock);
  const label = left
    ? `${DAY} ${clock.day ?? "—"} · ${phraseText(dayLeft(clock.secondsLeft))}`
    : `${DAY} ${clock.day ?? "—"}`;
  return (
    <span
      role="timer"
      aria-label={label}
      data-tip={tip}
      className={cn(
        "frontier-day-medallion frontier-day-medallion--phone pointer-events-auto",
        STORE_TONES[clock.tone].text,
      )}
    >
      <ProgressRing size="md" share={dayElapsedShare(clock)} tone={clock.tone} className="frontier-day-medallion__ring">
        <span className="frontier-day-stack">
          <span className="frontier-day-kicker">{DAY}</span>
          <span className="frontier-day-label">{clock.day ?? "—"}</span>
        </span>
      </ProgressRing>
      {left && (
        <span className="frontier-day-left" aria-hidden="true">
          {left}
        </span>
      )}
    </span>
  );
};

export const DayMedallion = ({ clock }: { clock: DayClock }) => {
  const left = dayLeftCompact(clock.secondsLeft);
  return (
    <span
      role="timer"
      aria-label="Day clock"
      data-tip={dayTip(clock)}
      data-tone={clock.tone}
      className={cn("frontier-day-dial pointer-events-auto tabular-nums", STORE_TONES[clock.tone].text)}
    >
      <img src={DAY_MEDALLION[clock.tone]} alt="" className="frontier-day-dial__bezel" />
      <ProgressRing share={dayElapsedShare(clock)} tone={clock.tone} className="frontier-day-dial__ring">
        <span className="frontier-day-stack">
          <span className="frontier-day-kicker">{DAY}</span>
          <span className="frontier-day-label">{clock.day ?? "—"}</span>
        </span>
      </ProgressRing>
      {left && (
        <span className="frontier-day-dial__plaque" aria-hidden="true">
          {left}
        </span>
      )}
      <span className="sr-only">{`${DAY} ${clock.day ?? "—"}${left ? ` · ${left} ${LEFT}` : ""}`}</span>
    </span>
  );
};
