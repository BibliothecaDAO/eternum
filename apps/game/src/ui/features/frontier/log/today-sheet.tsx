import "./today-sheet.css";

import { formatAmount } from "@bibliothecadao/types";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudSheet } from "@/ui/design-system/kit/hud-elements";
import {
  DAY,
  dayLeft,
  dayOfSeason,
  OPENING_WORDS,
  phraseText,
  TODAY,
  TODAY_WORDS,
  tomorrowLasts,
} from "@/ui/design-system/kit/words";

import type { DayClock } from "../hud/day-clock";
import { DayGains, type DayGainsReading } from "./day-gains";
import type { WeekDay } from "./quest-week";

export const TodaySheet = ({
  day,
  lastDay,
  clock,
  week,
  gains,
  onRecap,
  onClose,
}: {
  day: number | undefined;
  lastDay?: number;
  clock: DayClock;
  week?: readonly WeekDay[];
  gains: DayGainsReading;
  onRecap?: () => void;
  onClose: () => void;
}) => (
  <HudSheet
    label={TODAY}
    title={
      day !== undefined && lastDay !== undefined
        ? dayOfSeason(formatAmount(day), formatAmount(lastDay))
        : `${DAY} ${formatAmount(day)}`
    }
    beside={
      <HudChip tone="warn" icons={["hourglass"]} tip={phraseText(dayLeft(clock.secondsLeft))}>
        {dayLeft(clock.secondsLeft).reading}
      </HudChip>
    }
    onClose={onClose}
  >
    <div data-today className="today-sheet">
      <p role="timer" className="today-sheet__clock">
        {TODAY_WORDS.ends(clock.endsAt)} · {tomorrowLasts(clock.tomorrowSeconds).words}{" "}
        <b>{tomorrowLasts(clock.tomorrowSeconds).reading}</b>
      </p>
      {week && <TodayWeek week={week} />}
      <DayGains gains={gains} />
      {onRecap && (
        <span>
          <HudButton kind="secondary" icon="arrow-right" onClick={onRecap}>
            {TODAY_WORDS.yesterdaysRecap}
          </HudButton>
        </span>
      )}
    </div>
  </HudSheet>
);

const TodayWeek = ({ week }: { week: readonly WeekDay[] }) => (
  <section data-today-week aria-label={OPENING_WORDS.week} className="today-sheet__week">
    {week.map(({ day, quest, when, collected }) => (
      <span
        key={day}
        role="img"
        aria-label={OPENING_WORDS.weekDay(day, quest.name)}
        data-tip={OPENING_WORDS.weekDay(day, quest.name)}
        data-week-day={when}
        data-collected={collected || undefined}
        className="today-sheet__quest"
      >
        <Icon name={quest.icon} size={24} />
        <i>{day}</i>
      </span>
    ))}
  </section>
);
