import { resourceName, ResourcesIds, formatShort } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";

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
  { total: "labor", icon: "labor", name: resourceName(ResourcesIds.Labor, true), value: gained(totals.labor) },
  { total: "essence", icon: "essence", name: ESSENCE, value: gained(totals.essence) },
];

type TotalCell = { total: keyof DayTotals; icon: IconMeaning; name: string; value: string };

const gained = (value: number | undefined) => formatShort(value, { signed: true });
