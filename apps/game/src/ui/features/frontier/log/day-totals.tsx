import { resourceName, ResourcesIds, formatShort } from "@bibliothecadao/types";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";

import { ESSENCE, REVEALS, SITES_CLEARED } from "@/ui/design-system/kit/words";

export type DayTotals = {
  reveals: number | undefined;
  cleared: number | undefined;
  essence: number | undefined;
  labor: number | undefined;
};

export const dayTotalCells = (totals: DayTotals): TotalCell[] => [
  { total: "reveals", icon: "explore", name: REVEALS, value: formatShort(totals.reveals) },
  { total: "cleared", icon: "flag", name: SITES_CLEARED, value: formatShort(totals.cleared) },
  { total: "labor", icon: "labor", name: resourceName(ResourcesIds.Labor), value: gained(totals.labor) },
  { total: "essence", icon: "essence", name: ESSENCE, value: gained(totals.essence) },
];

export const DayTotalsGrid = ({ totals }: { totals: DayTotals }) => <TotalsGrid cells={dayTotalCells(totals)} />;

type TotalCell = { total: keyof DayTotals; icon: IconMeaning; name: string; value: string };

const TotalsGrid = ({ cells }: { cells: readonly TotalCell[] }) => (
  <div className="grid grid-cols-4 gap-1.5 lg:gap-2.5">
    {cells.map((cell) => (
      <span
        key={cell.icon}
        data-total={cell.icon}
        className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-hud-divider bg-hud-well px-1 py-2 text-center lg:px-3 lg:py-4"
      >
        <span
          role="img"
          aria-label={`${cell.name} ${cell.value}`}
          className="flex flex-col items-center gap-1 tabular-nums text-hud-ink"
        >
          <Icon name={cell.icon} size={22} />
          <b className="text-hud-title leading-none lg:text-hud-hero">{cell.value}</b>
        </span>
        <span className="text-hud-label text-hud-muted">{cell.name}</span>
      </span>
    ))}
  </div>
);

const gained = (value: number | undefined) => formatShort(value, { signed: true });
