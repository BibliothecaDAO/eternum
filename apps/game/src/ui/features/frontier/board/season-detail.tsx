import { formatAmount, LORDS } from "@bibliothecadao/types";
import { HudButton, HudChip, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { OrderMark } from "./realm-marks";
import {
  CAMP,
  CHESTS,
  CLEARED,
  ESSENCE,
  ETHEREAL,
  LABOR,
  REACH_NUMERALS,
  RIFT,
  RUIN,
  SEASON,
  STRAGGLERS,
  VISIT,
} from "@/ui/design-system/kit/words";

/** A realm's season, as Herald totals it. */
export type SeasonDetail = {
  rank: number;
  order: number;
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
  /** The realm's name, the sheet's title. */
  label: string;
  onVisit?: () => void;
  onClose: () => void;
}) => (
  // The sheet's header names the realm; under it, its Order and its rank.
  <HudSheet label={label} onClose={onClose}>
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2.5">
        <OrderMark order={detail.order} size={34} />
        <HudChip icons={["victory"]} label={SEASON}>
          {`#${detail.rank}`}
        </HudChip>
      </header>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <HudChip icons={["flag"]} label={CLEARED}>
          {formatAmount(detail.sites.total)}
        </HudChip>
        <span aria-hidden className="text-hud-body text-hud-muted">
          =
        </span>
        <HudChip icons={["camp"]} label={CAMP}>
          {formatAmount(detail.sites.camps)}
        </HudChip>
        <HudChip icons={["rift"]} label={RIFT}>
          {formatAmount(detail.sites.rifts)}
        </HudChip>
        <HudChip icons={["ruin"]} label={RUIN}>
          {formatAmount(detail.sites.ruins)}
        </HudChip>
        <HudChip icons={["troops"]} label={STRAGGLERS}>
          {formatAmount(detail.sites.stragglers)}
        </HudChip>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <HudChip icons={["chest"]} label={CHESTS}>
          {formatAmount(detail.chests)}
        </HudChip>
        <HudChip icons={["lords"]} label={LORDS}>
          {formatAmount(detail.lords)}
        </HudChip>
        <HudChip icons={["portal"]} label={ETHEREAL}>
          {reachShown(detail.reach)}
        </HudChip>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <HudChip icons={["essence"]} label={ESSENCE}>
          {`+${formatAmount(detail.essence)}`}
        </HudChip>
        <HudChip icons={["labor"]} label={LABOR}>
          {`+${formatAmount(detail.labor)}`}
        </HudChip>
      </div>
      {onVisit && (
        <HudButton kind="primary" icon="explore" onClick={onVisit}>
          {VISIT}
        </HudButton>
      )}
    </div>
  </HudSheet>
);

/** The deepest reach as its numeral; a realm that never went through reads 0, since a dash is kept for unknown. */
const reachShown = (reach: number): string => (reach === 0 ? formatAmount(0) : REACH_NUMERALS[reach - 1]);
