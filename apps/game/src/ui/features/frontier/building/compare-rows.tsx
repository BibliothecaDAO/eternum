import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import type { ReactNode } from "react";

/**
 * One thing a card compares now and next: its mark and word, its figure now, and next (none at the top). With `onPick`
 * the row is the side the next step takes, framed when picked; the figure that grows is lit.
 */
export type CompareRow = {
  icon: IconMeaning;
  word: string;
  now: string;
  next?: string;
  grows: boolean;
  onPick?: () => void;
};

const GRID = "grid grid-cols-[1fr_auto_1.25rem_minmax(4.5rem,auto)] items-center gap-x-2";
const GRID_NOW = "grid grid-cols-[1fr_auto] items-center gap-x-2";

/**
 * What a card gives now beside what its next step gives, read across one table (the owner's pick A, 26 October: "the
 * same view as the castle"): the castle's level against the next, a building's tier against its next. Without `next`
 * (the top reached), only the now column stands.
 */
export const CompareRows = ({ now, next, rows }: { now: ReactNode; next?: ReactNode; rows: readonly CompareRow[] }) => {
  const grid = next === undefined ? GRID_NOW : GRID;
  return (
    <div data-compare className="flex flex-col gap-1 text-hud-body tabular-nums">
      <div className={cn(grid, "px-2 text-hud-label text-hud-muted")}>
        <span />
        <span className="flex justify-center">{now}</span>
        {next !== undefined && (
          <>
            <span />
            <span className="flex justify-center">{next}</span>
          </>
        )}
      </div>
      {rows.map((row) => {
        const face = (
          <>
            <span className="flex min-w-0 items-center gap-1.5 text-hud-ink">
              <Icon name={row.icon} size={24} />
              <span className="truncate">{row.word}</span>
            </span>
            <span className="text-center text-hud-ink">{row.now}</span>
            {next !== undefined && (
              <>
                <span aria-hidden className="text-center text-hud-muted">
                  →
                </span>
                <span className={cn("text-center", row.grows ? "text-hud-good" : "text-hud-muted")}>
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
              grid,
              "rounded-md border px-2 py-1 text-left",
              row.grows ? "border-hud-accent bg-hud-chosen" : "border-hud-line hover:bg-hud-hover",
            )}
          >
            {face}
          </button>
        ) : (
          <div key={row.word} className={cn(grid, "px-2 py-1")}>
            {face}
          </div>
        );
      })}
    </div>
  );
};
