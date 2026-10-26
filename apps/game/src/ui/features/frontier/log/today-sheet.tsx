import { formatAmount, formatClockTime } from "@bibliothecadao/types";
import { HudEventRow, HudIconButton, HudNotice, HudRow, HudSheet } from "@/ui/design-system/kit/hud-elements";
import {
  DAY,
  DAY_HISTORY_SHORT,
  dayEnds,
  dayLeft,
  phraseText,
  TODAY,
  TODAY_ERROR,
  tomorrowLasts,
} from "@/ui/design-system/kit/words";
import { Icon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import type { DayClock } from "../hud/day-clock";
import { STORE_TONES } from "../hud/status-strip";

import { type DayTotals, DayTotalsGrid } from "./day-totals";
import type { DayHistory } from "./player-day";

/** One line of the day's log: when (unix seconds) and what happened. */
export type LogLine = { id: string; at: number; text: string };

/**
 * Today (wireframe 12), a sheet from the day's dial: today's clock line (when it ends, the time left, how long tomorrow
 * lasts; the strip keeps only the dial), the day's totals, the armies with a tier to buy, the day's log newest first,
 * and the stepper to earlier days. When the log did not answer, its
 * card says so, with Try again; when the history no longer reaches back to the day's start, it says so above the log.
 */
export const TodaySheet = ({
  day,
  today,
  clock,
  totals,
  armiesToUpgrade,
  lines,
  history,
  onRetry,
  onEarlier,
  onLater,
  onArmies,
  onClose,
}: {
  day: number | undefined;
  /** The day shown is today. */
  today: boolean;
  /** Today's clock, shown under the title while the day shown is today. */
  clock: DayClock;
  totals: DayTotals;
  /** Armies with an attribute tier their XP can buy; absent until the army's XP is read. */
  armiesToUpgrade?: number;
  lines: readonly LogLine[];
  /** How much of the day the player's history gives. */
  history: DayHistory;
  onRetry: () => void;
  /** Absent on the season's first day. */
  onEarlier?: () => void;
  /** Absent on today. */
  onLater?: () => void;
  onArmies?: () => void;
  onClose: () => void;
}) => {
  const title = `${DAY} ${formatAmount(day)}`;
  return (
    <HudSheet label={TODAY} onClose={onClose}>
      <span className="text-hud-title">{title}</span>
      {today && <DayClockLine clock={clock} />}
      <DayTotalsGrid totals={totals} />
      {armiesToUpgrade !== undefined && armiesToUpgrade > 0 && (
        <HudRow lead={<Icon name="picks" size={22} />} title={formatAmount(armiesToUpgrade)} onClick={onArmies} />
      )}
      {history === "short" && <HudNotice line={DAY_HISTORY_SHORT} />}
      {history === "failed" ? (
        <HudNotice tone="bad" line={TODAY_ERROR} retry={onRetry} />
      ) : (
        <ol className="flex max-h-hud-list flex-col overflow-y-auto">
          {lines.map((line) => (
            <li key={line.id}>
              <HudEventRow time={formatClockTime(line.at)}>{line.text}</HudEventRow>
            </li>
          ))}
        </ol>
      )}
      <nav className="flex items-center gap-2">
        <HudIconButton
          icon="arrow-left"
          label={`${DAY} ${formatAmount(day && day - 1)}`}
          kind="quiet"
          disabled={!onEarlier}
          onClick={onEarlier}
        />
        <span className="flex-1 text-center text-hud-strong">{today ? TODAY : title}</span>
        <HudIconButton
          icon="arrow-right"
          label={`${DAY} ${formatAmount(day && day + 1)}`}
          kind="quiet"
          disabled={!onLater}
          onClick={onLater}
        />
      </nav>
    </HudSheet>
  );
};

/** Today's clock in words, in the day's tone: "Day ends 21:40 · 7h 14m left · Tomorrow lasts 12h"; unknown a dash. */
const DayClockLine = ({ clock }: { clock: DayClock }) => (
  <p role="timer" className={cn("flex flex-wrap items-baseline gap-x-1 tabular-nums", STORE_TONES[clock.tone].text)}>
    <span>{phraseText(dayEnds(clock.endsAt))}</span>
    <span aria-hidden>·</span>
    <span>{phraseText(dayLeft(clock.secondsLeft))}</span>
    <span aria-hidden>·</span>
    <span>{phraseText(tomorrowLasts(clock.tomorrowSeconds))}</span>
  </p>
);
