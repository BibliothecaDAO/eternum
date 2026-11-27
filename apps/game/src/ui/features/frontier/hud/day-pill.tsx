import { UNKNOWN } from "@bibliothecadao/types";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import { SheetDock } from "@/ui/design-system/kit/hud-elements";
import type { ReactNode } from "react";
import {
  DAY,
  dayEnds,
  dayShort,
  dayLeft,
  dayLeftCompact,
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
  card,
  onOpenToday,
}: {
  rules: ExpeditionRules;
  compact?: boolean;
  card?: ReactNode;
  onOpenToday: () => void;
}) => {
  const clock = dayClock(rules, useNowSeconds());
  const finished = useGameFinished();
  if (finished) return <GameFinishedPill />;
  return (
    <div className="frontier-day-wrap pointer-events-auto">
      <button
        type="button"
        aria-label={TODAY}
        aria-expanded={Boolean(card)}
        data-hud-part=""
        onClick={onOpenToday}
        className="frontier-day-trigger"
      >
        <DayPill clock={clock} compact={compact} />
      </button>
      {card && <SheetDock.Provider value={null}>{card}</SheetDock.Provider>}
    </div>
  );
};

export const DayPill = ({ clock, compact = false }: { clock: DayClock; compact?: boolean }) => {
  const left = dayLeftCompact(clock.secondsLeft);
  const day = clock.day ?? UNKNOWN;
  const elapsed = dayElapsedShare(clock);
  return (
    <span
      role="timer"
      aria-label={left ? `${DAY} ${day} · ${phraseText(dayLeft(clock.secondsLeft))}` : `${DAY} ${day}`}
      data-tip={dayTip(clock)}
      data-tone={clock.tone}
      data-compact={compact || undefined}
      className={cn("ui-popover frontier-day-pill tabular-nums", STORE_TONES[clock.tone].text)}
    >
      {!compact && (
        <ProgressRing size="sm" share={elapsed} tone={clock.tone} className="frontier-day-pill__ring">
          <Icon name="sun" size={12} />
        </ProgressRing>
      )}
      <span className="frontier-day-pill__day">
        {compact ? (
          dayShort(day)
        ) : (
          <>
            {DAY} <span className="frontier-day-pill__numeral">{day}</span>
          </>
        )}
      </span>
      {left && <span className="frontier-day-pill__left">{left}</span>}
      {elapsed !== undefined && (
        <span
          aria-hidden="true"
          className="frontier-day-pill__share"
          style={{ width: `${Math.round(elapsed * 100)}%` }}
        />
      )}
    </span>
  );
};
