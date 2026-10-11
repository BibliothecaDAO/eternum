import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { formatClockTime } from "@/ui/design-system/kit/time";
import { DAY, TODAY, TODAY_ERROR, TRY_AGAIN } from "@/ui/design-system/kit/words";

import { CardFanGlyph } from "../glyphs";
import { type DayTotals, DayTotalsGrid } from "./day-totals";

/** One line of the day's log: when (unix seconds) and what happened. */
export type LogLine = { id: string; at: number; text: string };

/**
 * Today (wireframe 12), a sheet from the Menu: the day's totals, the armies with a tier to buy, the day's log newest
 * first, and the stepper to earlier days. The clock is on the strip, not repeated. When the log did not answer, its
 * card says so, with Try again.
 */
export const TodaySheet = ({
  day,
  today,
  totals,
  armiesToUpgrade,
  lines,
  failed,
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
  failed: boolean;
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
    <Sheet label={TODAY} onClose={onClose}>
      <h2 className="frontier-title !text-[20px]">{title}</h2>
      <DayTotalsGrid totals={totals} />
      {armiesToUpgrade !== undefined && armiesToUpgrade > 0 && (
        <button
          type="button"
          onClick={onArmies}
          className="frontier-card flex h-12 items-center gap-2 !rounded-xl px-2.5 text-[15px] tabular-nums text-kit-cream"
        >
          <CardFanGlyph className="size-[22px]" />
          {formatAmount(armiesToUpgrade)}
          <span className="flex-1" />
          <KitIcon code="Cv" size={18} />
        </button>
      )}
      {failed ? (
        <ReasonPlate
          reason={{ kind: "failed", line: TODAY_ERROR }}
          step={<Button role="secondary" word={TRY_AGAIN} onClick={onRetry} />}
        />
      ) : (
        <ol className="flex max-h-[40vh] flex-col overflow-y-auto">
          {lines.map((line) => (
            <li key={line.id} className="flex h-[30px] shrink-0 items-center gap-2 border-b border-kit-line">
              <span className="text-[14px] tabular-nums text-kit-muted">{formatClockTime(line.at)}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-kit-cream">{line.text}</span>
            </li>
          ))}
        </ol>
      )}
      <nav className="flex h-12 items-center gap-2">
        <StepArrow back label={`${DAY} ${formatAmount(day && day - 1)}`} onClick={onEarlier} />
        <span className="flex-1 text-center text-[14px] font-semibold text-kit-cream">{today ? TODAY : title}</span>
        <StepArrow label={`${DAY} ${formatAmount(day && day + 1)}`} onClick={onLater} />
      </nav>
    </Sheet>
  );
};

/** The stepper's arrow: back to the day before, or on toward today; dim where there is no day to go to. */
const StepArrow = ({ back = false, label, onClick }: { back?: boolean; label: string; onClick?: () => void }) => (
  <button
    type="button"
    aria-label={label}
    disabled={!onClick}
    onClick={onClick}
    className="flex size-12 items-center justify-center rounded-xl disabled:opacity-35"
  >
    <KitIcon code="Ar" size={22} className={cn(back && "-scale-x-100")} />
  </button>
);
