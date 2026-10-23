import { formatAmount, formatClockTime } from "@bibliothecadao/types";
import { HudEventRow, HudIconButton, HudNotice, HudRow, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { DAY, DAY_HISTORY_SHORT, TODAY, TODAY_ERROR } from "@/ui/design-system/kit/words";
import { Icon } from "@/ui/design-system/icon";

import { type DayTotals, DayTotalsGrid } from "./day-totals";
import type { DayHistory } from "./player-day";

/** One line of the day's log: when (unix seconds) and what happened. */
export type LogLine = { id: string; at: number; text: string };

/**
 * Today (wireframe 12), a sheet from the Menu: the day's totals, the armies with a tier to buy, the day's log newest
 * first, and the stepper to earlier days. The clock is on the strip, not repeated. When the log did not answer, its
 * card says so, with Try again; when the history no longer reaches back to the day's start, it says so above the log.
 */
export const TodaySheet = ({
  day,
  today,
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
