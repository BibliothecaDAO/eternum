import { formatAmount } from "@/ui/design-system/kit/amount";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
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

import { FigureChip } from "./figure-chip";

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
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <OrderEmblem order={detail.order} size={34} />
        <span className="min-w-0 flex-1 truncate text-hud-title">{detail.name}</span>
        <FigureChip icons={["victory"]} label={SEASON} value={`#${detail.rank}`} />
      </header>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <FigureChip icons={["flag"]} label={CLEARED} value={formatAmount(detail.sites.total)} />
        <span aria-hidden className="text-hud-body text-hud-muted">
          =
        </span>
        <FigureChip icons={["camp"]} label={CAMP} value={formatAmount(detail.sites.camps)} />
        <FigureChip icons={["rift"]} label={RIFT} value={formatAmount(detail.sites.rifts)} />
        <FigureChip icons={["ruin"]} label={RUIN} value={formatAmount(detail.sites.ruins)} />
        <FigureChip icons={["troops"]} label={STRAGGLERS} value={formatAmount(detail.sites.stragglers)} />
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <FigureChip icons={["chest"]} label={CHESTS} value={formatAmount(detail.chests)} />
        <FigureChip icons={["lords"]} label={LORDS} value={formatAmount(detail.lords)} />
        <FigureChip icons={["portal"]} label={ETHEREAL} value={reachShown(detail.reach)} />
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <FigureChip icons={["essence"]} label={ESSENCE} value={`+${formatAmount(detail.essence)}`} />
        <FigureChip icons={["labor"]} label={LABOR} value={`+${formatAmount(detail.labor)}`} />
      </div>
      {onVisit && (
        <HudButton kind="primary" icon="explore" onClick={onVisit}>
          {VISIT}
        </HudButton>
      )}
    </div>
  </Sheet>
);

/** The deepest reach as its numeral; a realm that never went through reads 0, since a dash is kept for unknown. */
const reachShown = (reach: number): string => (reach === 0 ? formatAmount(0) : REACH_NUMERALS[reach - 1]);
