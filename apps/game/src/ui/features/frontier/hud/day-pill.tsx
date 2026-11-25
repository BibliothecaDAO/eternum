import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { DAY_MEDALLION } from "@/ui/design-system/icon-meaning";
import { DAY, dayEnds, dayLeft, dayLeftCompact, phraseText, TODAY, tomorrowLasts } from "@/ui/design-system/kit/words";
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
    <button
      type="button"
      aria-label={TODAY}
      data-hud-part=""
      onClick={onOpenToday}
      className="frontier-day-trigger pointer-events-auto"
    >
      <DayMedallion clock={clock} size={compact ? 52 : 64} />
    </button>
  );
};

export const DayMedallion = ({ clock, size = 64 }: { clock: DayClock; size?: 52 | 64 }) => {
  const left = dayLeftCompact(clock.secondsLeft);
  const label = left
    ? `${DAY} ${clock.day ?? "—"} · ${phraseText(dayLeft(clock.secondsLeft))}`
    : `${DAY} ${clock.day ?? "—"}`;
  return (
    <span
      role="timer"
      aria-label={label}
      data-tip={dayTip(clock)}
      data-tone={clock.tone}
      data-size={size}
      className={cn("frontier-day-dial pointer-events-auto tabular-nums", STORE_TONES[clock.tone].text)}
    >
      <img
        src={clock.tone === "ember" ? DAY_MEDALLION[size].ember : DAY_MEDALLION[size].calm}
        alt=""
        className="frontier-day-dial__bezel"
      />
      <ProgressRing share={dayElapsedShare(clock)} tone={clock.tone} className="frontier-day-dial__ring">
        <span className="frontier-day-dial__face" aria-hidden="true">
          <span className="frontier-day-dial__kicker">{DAY}</span>
          <span className="frontier-day-dial__numeral">{clock.day ?? "—"}</span>
          {left && <span className="frontier-day-dial__left">{left}</span>}
        </span>
      </ProgressRing>
    </span>
  );
};
