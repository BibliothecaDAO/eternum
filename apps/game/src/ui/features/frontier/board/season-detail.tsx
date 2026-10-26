import { structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import { formatAmount, formatGain, frontierSiteName, LORDS, StructureType } from "@bibliothecadao/types";
import { HudButton, HudChip, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { OrderMark } from "./realm-marks";
import {
  CHESTS,
  CLEARED,
  ESSENCE,
  DEPTH,
  DEPTH_NUMERALS,
  LABOR,
  RIFT,
  RUIN,
  SEASON,
  BEASTS,
  VISIT,
} from "@/ui/design-system/kit/words";

/** A realm's season, as Herald totals it. */
export type SeasonDetail = {
  rank: number;
  order: number;
  sites: { total: number; camps: number; rifts: number; ruins: number; beasts: number };
  chests: number;
  lords: number;
  /** The deepest depth beyond the spire, 1 to 3; 0 for a realm that never went through. */
  depth: number;
  essence: number;
  labor: number;
};

/**
 * A row tapped (wireframe 13): the realm's Order, name and rank, its sites cleared by kind (camp, rift, ruin,
 * beasts), chests, LORDS and its depth once it has gone through, what it earned, and one verb: Visit. The player's own row has
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
        <HudChip
          icons={[structureMeaning(StructureType.Camp, "frontier")]}
          label={frontierSiteName(StructureType.Camp)}
        >
          {formatAmount(detail.sites.camps)}
        </HudChip>
        <HudChip icons={["rift"]} label={RIFT}>
          {formatAmount(detail.sites.rifts)}
        </HudChip>
        <HudChip icons={["ruin"]} label={RUIN}>
          {formatAmount(detail.sites.ruins)}
        </HudChip>
        <HudChip icons={["troops"]} label={BEASTS}>
          {formatAmount(detail.sites.beasts)}
        </HudChip>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <HudChip icons={["chest"]} label={CHESTS}>
          {formatAmount(detail.chests)}
        </HudChip>
        <HudChip icons={["lords"]} label={LORDS}>
          {formatAmount(detail.lords)}
        </HudChip>
        {detail.depth > 0 && (
          <HudChip icons={["portal"]} label={DEPTH}>
            {DEPTH_NUMERALS[detail.depth - 1]}
          </HudChip>
        )}
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <HudChip icons={["essence"]} label={ESSENCE}>
          {formatGain(detail.essence)}
        </HudChip>
        <HudChip icons={["labor"]} label={LABOR}>
          {formatGain(detail.labor)}
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
