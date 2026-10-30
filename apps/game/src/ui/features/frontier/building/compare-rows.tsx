import { cn } from "@/ui/design-system/atoms/lib/utils";
import { IconGroup, type IconMark } from "@/ui/design-system/icon";
import type { ReactNode } from "react";

/**
 * One thing a card compares now and next: its mark and word, its figure now, and next (none at the top). With `onPick`
 * the row is the side the next step takes, framed when picked; the figure that grows is lit.
 */
type CompareRow = {
  icon: IconMark;
  word: string;
  /** What the figure is of, under its word, wrapped at any width (a research side's "Wheat from every Farm"). */
  line?: string;
  now: string;
  next?: string;
  grows: boolean;
  onPick?: () => void;
};

/** One row's cells: the thing's word takes what is left, each figure a fixed column so the rows read across. */
const ROW = "flex items-center gap-2";
const WORD = "flex min-w-0 flex-1 items-center gap-1.5";
const FIGURE = "min-w-16 shrink-0 whitespace-nowrap text-center";
const ARROW = "w-4 shrink-0 text-center";

/**
 * What a card gives now beside what its next step gives, read across one table (the owner's pick A, 26 October: "the
 * same view as the castle"): the castle's level against the next, a building's tier against its next. Without `next`
 * (the top reached), only the now column stands. `corner` fills the head's free corner over the rows' words (the
 * castle's labor a minute), so a card spends no line of its own on it.
 */
export const CompareRows = ({
  now,
  next,
  corner,
  rows,
}: {
  now: ReactNode;
  next?: ReactNode;
  corner?: ReactNode;
  rows: readonly CompareRow[];
}) => {
  return (
    <div data-compare className="flex flex-col gap-1 text-hud-body tabular-nums">
      <div className={cn(ROW, "px-2 text-hud-label text-hud-muted")}>
        <span className="flex min-w-0 flex-1">{corner}</span>
        <span className={cn(FIGURE, "flex justify-center")}>{now}</span>
        {next !== undefined && (
          <>
            <span className={ARROW} />
            <span className={cn(FIGURE, "flex justify-center")}>{next}</span>
          </>
        )}
      </div>
      {rows.map((row) => {
        const face = (
          <>
            <span className={cn(WORD, "text-hud-ink")}>
              <IconGroup name={row.icon} size={24} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{row.word}</span>
                {row.line && (
                  <span data-line className="text-hud-label leading-tight text-hud-muted">
                    {row.line}
                  </span>
                )}
              </span>
            </span>
            <span className={cn(FIGURE, "text-hud-ink")}>{row.now}</span>
            {next !== undefined && (
              <>
                <span aria-hidden className={cn(ARROW, "text-hud-muted")}>
                  →
                </span>
                <span className={cn(FIGURE, row.grows ? "text-hud-good" : "text-hud-muted")}>
                  {row.next ?? row.now}
                </span>
              </>
            )}
          </>
        );
        return row.onPick ? (
          <button
            key={row.word}
            type="button"
            aria-pressed={row.grows}
            onClick={row.onPick}
            className={cn(
              ROW,
              "rounded-md border px-2 py-1 text-left",
              row.grows ? "border-hud-accent bg-hud-chosen" : "border-hud-line hover:bg-hud-hover",
            )}
          >
            {face}
          </button>
        ) : (
          <div key={row.word} className={cn(ROW, "px-2 py-0.5")}>
            {face}
          </div>
        );
      })}
    </div>
  );
};
