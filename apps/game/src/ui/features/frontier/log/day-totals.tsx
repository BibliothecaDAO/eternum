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
  <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
    {cells.map((cell) => (
      <span
        key={cell.icon}
        data-total={cell.icon}
        className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-hud-divider bg-hud-well px-3 py-4"
      >
        <span
          role="img"
          aria-label={`${cell.name} ${cell.value}`}
          className="flex flex-col items-center gap-1.5 tabular-nums text-hud-ink"
        >
          <Icon name={cell.icon} size={32} />
          <b className="text-hud-display leading-none lg:text-hud-hero">{cell.value}</b>
        </span>
        <span className="text-hud-label text-hud-muted">{cell.name}</span>
      </span>
    ))}
  </div>
);

const gained = (value: number | undefined) => formatShort(value, { signed: true });
