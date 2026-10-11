import { formatAmount } from "@/ui/design-system/kit/amount";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";

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
      { icon: "Ey", value: formatAmount(totals.reveals) },
      { icon: "Fl", value: formatAmount(totals.cleared) },
      { icon: "Ch", value: formatAmount(totals.chests) },
      { icon: "Es", value: gained(totals.essence) },
      { icon: "La", value: gained(totals.labor) },
      { icon: "Lo", value: gained(totals.lords) },
    ]}
  />
);

/** Totals as icons over numbers, three to a row: a day's, or a season's. */
export const TotalsGrid = ({ cells }: { cells: readonly { icon: IconCode; value: string }[] }) => (
  <dl className="frontier-card grid w-full grid-cols-3 gap-y-1 !rounded-xl px-1.5 py-2">
    {cells.map((cell) => (
      <Total key={cell.icon} icon={cell.icon} value={cell.value} />
    ))}
  </dl>
);

const gained = (amount: number | undefined) => (amount === undefined ? "—" : `+${formatAmount(amount)}`);

const Total = ({ icon, value }: { icon: IconCode; value: string }) => (
  <span className="flex h-[34px] items-center justify-center gap-1.5">
    <KitIcon code={icon} size={22} />
    <span className="text-[17px] tabular-nums">{value}</span>
  </span>
);
