import "./today-sheet.css";

import { formatAmount, formatShort } from "@bibliothecadao/types";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudSheet } from "@/ui/design-system/kit/hud-elements";
import {
  ASPECT_PAGE_WORDS,
  DAY,
  dayLeft,
  dayOfSeason,
  ESSENCE,
  LABOR,
  OPENING_WORDS,
  phraseText,
  TODAY,
  TODAY_WORDS,
  tomorrowLasts,
} from "@/ui/design-system/kit/words";

import type { DayClock } from "../hud/day-clock";
import type { WeekDay } from "./quest-week";

type DayGains = { essence: number | undefined; labor: number | undefined; glory: number | undefined };

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
  gains: DayGains;
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
      <div className="today-sheet__gains">
        <Gain total="essence" icon="essence" value={signed(gains.essence)} name={ESSENCE} />
        <Gain total="labor" icon="labor" value={signed(gains.labor)} name={LABOR} />
        <Gain total="glory" icon="crown" value={formatShort(gains.glory)} name={ASPECT_PAGE_WORDS.glory} />
      </div>
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

const signed = (value: number | undefined) => formatShort(value, { signed: true });

const Gain = ({ total, icon, value, name }: { total: string; icon: IconMeaning; value: string; name: string }) => (
  <span data-total={total} role="img" aria-label={`${name} ${value}`} className="today-sheet__gain">
    <Icon name={icon} size={30} />
    <b>{value}</b>
    <span>{name}</span>
  </span>
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
