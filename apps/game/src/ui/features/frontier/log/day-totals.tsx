import { formatAmount } from "@/ui/design-system/kit/amount";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { CHESTS, ESSENCE, LABOR, LORDS, REVEALS, SITES_CLEARED } from "@/ui/design-system/kit/words";

/** A day's totals as the log counts them; LORDS arrive with the contracts' ruin chests. Unknown shows as a dash. */
export type DayTotals = {
  reveals: number | undefined;
  cleared: number | undefined;
  chests: number | undefined;
  essence: number | undefined;
  labor: number | undefined;
  lords: number | undefined;
};

/** The day's totals in two rows: what was revealed, cleared and found, then what it paid. */
export const DayTotalsGrid = ({ totals }: { totals: DayTotals }) => (
  <TotalsGrid
    cells={[
      { icon: "Ey", name: REVEALS, value: formatAmount(totals.reveals) },
      { icon: "Fl", name: SITES_CLEARED, value: formatAmount(totals.cleared) },
      { icon: "Ch", name: CHESTS, value: formatAmount(totals.chests) },
      { icon: "Es", name: ESSENCE, value: gained(totals.essence) },
      { icon: "La", name: LABOR, value: gained(totals.labor) },
      { icon: "Lo", name: LORDS, value: gained(totals.lords) },
    ]}
  />
);

/** One total: its icon, the name the icon stands for, and its figure. */
type TotalCell = { icon: IconCode; name: string; value: string };

/**
 * Totals as icons beside numbers, three to a row: a day's, or a season's. Each cell is one image named with its
 * figure ("Reveals 31"), which is what a screen reader says and what the tooltip shows.
 */
export const TotalsGrid = ({ cells }: { cells: readonly TotalCell[] }) => (
  <div className="frontier-card grid w-full grid-cols-3 gap-y-1 !rounded-xl px-1.5 py-2">
    {cells.map((cell) => (
      <Total key={cell.icon} cell={cell} />
    ))}
  </div>
);

const gained = (amount: number | undefined) => (amount === undefined ? "—" : `+${formatAmount(amount)}`);

const Total = ({ cell }: { cell: TotalCell }) => (
  <span
    role="img"
    aria-label={`${cell.name} ${cell.value}`}
    className="flex h-[34px] items-center justify-center gap-1.5"
  >
    <KitIcon code={cell.icon} size={22} />
    <span className="text-base tabular-nums">{cell.value}</span>
  </span>
);
