import { formatAmount } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { Sheet } from "@/ui/design-system/kit/sheet";
import {
  CAMP,
  CHESTS,
  CLEARED,
  ESSENCE,
  ETHEREAL,
  LABOR,
  LORDS,
  REACH_NUMERALS,
  RIFT,
  RUIN,
  SEASON,
  STRAGGLERS,
  VISIT,
} from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/** A realm's season, as Herald totals it. */
export type SeasonDetail = {
  rank: number;
  order: number;
  name: ReactNode;
  sites: { total: number; camps: number; rifts: number; ruins: number; stragglers: number };
  chests: number;
  lords: number;
  /** The deepest reach beyond the spire, 1 to 3; 0 for a realm that never went through. */
  reach: number;
  essence: number;
  labor: number;
};

/**
 * A row tapped (wireframe 13): the realm's Order, name and rank, its sites cleared by kind (camp, rift, ruin,
 * stragglers), chests, LORDS and the deepest reach, what it earned, and one verb: Visit. The player's own row has
 * nothing to visit.
 */
export const SeasonDetailSheet = ({
  detail,
  label,
  onVisit,
  onClose,
}: {
  detail: SeasonDetail;
  /** The realm's name as text, for the sheet's label. */
  label: string;
  onVisit?: () => void;
  onClose: () => void;
}) => (
  <Sheet label={label} onClose={onClose}>
    <header className="flex h-11 items-center gap-2.5">
      <OrderEmblem order={detail.order} size={34} />
      <span className="min-w-0 flex-1 truncate text-[20px] text-kit-cream">{detail.name}</span>
      <Chip icons={["Tp"]} label={SEASON} value={`#${detail.rank}`} />
    </header>
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <Chip icons={["Fl"]} label={CLEARED} value={formatAmount(detail.sites.total)} />
      <span aria-hidden className="text-[16px] text-kit-muted">
        =
      </span>
      <Chip icons={["Cp"]} label={CAMP} value={formatAmount(detail.sites.camps)} />
      <Chip icons={["Rf"]} label={RIFT} value={formatAmount(detail.sites.rifts)} />
      <Chip icons={["Fr"]} label={RUIN} value={formatAmount(detail.sites.ruins)} />
      <Chip icons={["Tr"]} label={STRAGGLERS} value={formatAmount(detail.sites.stragglers)} />
    </div>
    <div className="flex items-center justify-center gap-1.5">
      <Chip icons={["Ch"]} label={CHESTS} value={formatAmount(detail.chests)} />
      <Chip icons={["Lo"]} label={LORDS} value={formatAmount(detail.lords)} />
      <Chip icons={["Dp"]} label={ETHEREAL} value={reachShown(detail.reach)} />
    </div>
    <div className="flex items-center justify-center gap-1.5">
      <Chip icons={["Es"]} label={ESSENCE} value={`+${formatAmount(detail.essence)}`} />
      <Chip icons={["La"]} label={LABOR} value={`+${formatAmount(detail.labor)}`} />
    </div>
    {onVisit && <Button role="primary" icon="Ey" word={VISIT} onClick={onVisit} />}
  </Sheet>
);

/** The deepest reach as its numeral; a realm that never went through reads 0, since a dash is kept for unknown. */
const reachShown = (reach: number): string => (reach === 0 ? formatAmount(0) : REACH_NUMERALS[reach - 1]);
