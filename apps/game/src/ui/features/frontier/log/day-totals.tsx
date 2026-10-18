import type { IconMeaning } from "@/ui/design-system/icon";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { HudChip, HudPanel } from "@/ui/design-system/kit/hud-elements";

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
      { icon: "explore", name: REVEALS, value: formatAmount(totals.reveals) },
      { icon: "flag", name: SITES_CLEARED, value: formatAmount(totals.cleared) },
      { icon: "chest", name: CHESTS, value: formatAmount(totals.chests) },
      { icon: "essence", name: ESSENCE, value: gained(totals.essence) },
      { icon: "labor", name: LABOR, value: gained(totals.labor) },
      { icon: "lords", name: LORDS, value: gained(totals.lords) },
    ]}
  />
);

/** One total: its icon, the name the icon stands for, and its figure. */
type TotalCell = { icon: IconMeaning; name: string; value: string };

/**
 * Totals as icons beside numbers, three to a row: a day's, or a season's. Each cell is one image named with its
 * figure ("Reveals 31"), which is what a screen reader says and what the tooltip shows.
 */
export const TotalsGrid = ({ cells }: { cells: readonly TotalCell[] }) => (
  <HudPanel collapsible={false} bodyClassName="grid grid-cols-3 justify-items-center gap-1">
    {cells.map((cell) => (
      <HudChip key={cell.icon} icons={[cell.icon]} label={cell.name}>
        {cell.value}
      </HudChip>
    ))}
  </HudPanel>
);

const gained = (amount: number | undefined) => (amount === undefined ? "—" : `+${formatAmount(amount)}`);
