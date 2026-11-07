import { LORDS, resourceName, ResourcesIds, formatShort } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";
import { HudChip, HudPanel } from "@/ui/design-system/kit/hud-elements";

import { CHESTS, ESSENCE, REVEALS, SITES_CLEARED } from "@/ui/design-system/kit/words";

/** A day's totals as the log counts them; LORDS arrive with the contracts' ruin chests. Unknown shows as a dash. */
export type DayTotals = {
  reveals: number | undefined;
  cleared: number | undefined;
  chests: number | undefined;
  essence: number | undefined;
  labor: number | undefined;
  lords: number | undefined;
};

/** A day's totals as every surface writes them: what was revealed, cleared and found, then what it paid. */
export const dayTotalCells = (totals: DayTotals): TotalCell[] => [
  { icon: "explore", name: REVEALS, value: formatShort(totals.reveals) },
  { icon: "flag", name: SITES_CLEARED, value: formatShort(totals.cleared) },
  { icon: "chest", name: CHESTS, value: formatShort(totals.chests) },
  { icon: "essence", name: ESSENCE, value: gained(totals.essence) },
  { icon: "labor", name: resourceName(ResourcesIds.Labor), value: gained(totals.labor) },
  { icon: "lords", name: LORDS, value: gained(totals.lords) },
];

/** The day's totals in two rows: what was revealed, cleared and found, then what it paid. */
export const DayTotalsGrid = ({ totals }: { totals: DayTotals }) => <TotalsGrid cells={dayTotalCells(totals)} />;

/** One total: its icon, the name the icon stands for, and its figure. */
type TotalCell = { icon: IconMeaning; name: string; value: string };

/**
 * A day's totals, three to a row. Each cell is its icon beside its figure, named in words under it
 * ("Reveals"), and one image named with its figure ("Reveals 31") for a screen reader.
 */
const TotalsGrid = ({ cells }: { cells: readonly TotalCell[] }) => (
  <HudPanel collapsible={false} bodyClassName="grid grid-cols-3 justify-items-center gap-x-1 gap-y-2">
    {cells.map((cell) => (
      <span key={cell.icon} data-total={cell.icon} className="flex flex-col items-center gap-0.5">
        <HudChip icons={[cell.icon]} label={cell.name}>
          {cell.value}
        </HudChip>
        <span className="text-hud-label text-hud-muted">{cell.name}</span>
      </span>
    ))}
  </HudPanel>
);

/** A gain in a totals chip, short and signed. */
const gained = (value: number | undefined) => formatShort(value, { signed: true });
