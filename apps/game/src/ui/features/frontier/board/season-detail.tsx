import type { SiteKind } from "@bibliothecadao/eternum";
import { LORDS, formatShort, layerName } from "@bibliothecadao/types";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { TARGET_MARKS } from "../sites/site-marks";
import { OrderEmblem, OrderLine } from "@/ui/design-system/kit/order-emblem";
import { CHESTS, ESSENCE, LABOR, LAYER, SEASON, SITES_CLEARED, VISIT } from "@/ui/design-system/kit/words";

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

/** Herald's count for each kind of site: every kind has one, or this does not compile. */
export const SITE_COUNTS = {
  Camp: "camps",
  Rift: "rifts",
  Ruin: "ruins",
  Beasts: "beasts",
} as const satisfies Record<SiteKind, keyof SeasonDetail["sites"]>;
export const SITE_KINDS = Object.keys(SITE_COUNTS) as SiteKind[];

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
  <HudSheet label={label} onClose={onClose}>
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2.5">
        {detail.order > 0 ? (
          <OrderLine
            orderId={detail.order}
            size={30}
            className="inline-flex min-w-0 items-center gap-2 font-hud-display text-hud-body text-hud-ink"
          />
        ) : (
          <OrderEmblem order={detail.order} size={30} />
        )}
        <HudChip icons={["victory"]} label={SEASON}>
          {`#${detail.rank}`}
        </HudChip>
      </header>
      <section className="flex flex-col gap-2 rounded-hud-control border border-hud-line bg-hud-well p-2.5">
        <div
          className="flex items-center justify-between gap-2 border-b border-hud-divider pb-1.5"
          aria-label={`${SITES_CLEARED} ${formatShort(detail.sites.total)}`}
          data-tip={`${SITES_CLEARED}: ${formatShort(detail.sites.total)}`}
        >
          <span className="inline-flex items-center gap-1.5 text-hud-label text-hud-muted">
            <Icon name="flag" size={16} />
            <span>{SITES_CLEARED}</span>
          </span>
          <span className="tabular-nums text-hud-strong text-hud-ink">{formatShort(detail.sites.total)}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {SITE_KINDS.map((kind) => (
            <DetailStat
              key={kind}
              icon={TARGET_MARKS[kind].icon}
              label={TARGET_MARKS[kind].word}
              value={formatShort(detail.sites[SITE_COUNTS[kind]])}
            />
          ))}
        </div>
      </section>
      <div className="grid grid-cols-2 gap-1.5">
        <DetailStat icon="chest" label={CHESTS} value={formatShort(detail.chests)} boxed />
        <DetailStat icon="lords" label={LORDS} value={formatShort(detail.lords)} boxed />
        <DetailStat icon="essence" label={ESSENCE} value={formatShort(detail.essence, { signed: true })} boxed />
        <DetailStat icon="labor" label={LABOR} value={formatShort(detail.labor, { signed: true })} boxed />
        {detail.depth > 0 && <DetailStat icon="portal" label={LAYER} value={layerName(detail.depth)} boxed wide />}
      </div>
      {onVisit && (
        <HudButton kind="primary" icon="explore" onClick={onVisit}>
          {VISIT}
        </HudButton>
      )}
    </div>
  </HudSheet>
);

const DetailStat = ({
  icon,
  label,
  value,
  boxed = false,
  wide = false,
}: {
  icon: IconMeaning;
  label: string;
  value: string;
  boxed?: boolean;
  wide?: boolean;
}) => (
  <div
    aria-label={`${label} ${value}`}
    data-tip={`${label}: ${value}`}
    className={
      boxed
        ? `flex min-w-0 items-center justify-between gap-1.5 rounded-hud-control border border-hud-line bg-hud-well px-2.5 py-1.5${wide ? " col-span-2" : ""}`
        : "flex min-w-0 items-center justify-between gap-1.5 rounded-hud-control px-1.5 py-1"
    }
  >
    <span className="inline-flex min-w-0 items-center gap-1.5 text-hud-label text-hud-muted">
      <Icon name={icon} size={18} />
      <span className="truncate">{label}</span>
    </span>
    <span className="shrink-0 tabular-nums text-hud-strong text-hud-ink">{value}</span>
  </div>
);
