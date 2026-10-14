import { formatAmount, formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { SeasonRow } from "@/ui/design-system/kit/season-row";
import { type Tier, TierChip } from "@/ui/design-system/kit/tier-chip";
import {
  BACK,
  LORDS,
  LORDS_EARNED,
  PER_SHARE,
  POOL_NOT_PUBLISHED,
  SEASON,
  SEASON_ERROR,
  SEASON_POOL,
  SHARE_CEILING,
  SITES_CLEARED,
  TODAY,
  TRY_AGAIN,
} from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/** A realm's row on the list: what SeasonRow draws, keyed to open its detail. */
export type SeasonListRow = {
  key: string;
  rank: number;
  order: number;
  name: ReactNode;
  sitesCleared: number;
  lords: number;
  own: boolean;
};

/** How many skeleton rows stand in while the season loads. */
const SKELETON_ROWS = 8;

/**
 * Season (wireframe 13), a page from the Menu, so it has Back: the title with what a common chest pays today and the
 * player's rank, the season's pool with what today releases of it and a share's price (or that the pool is not
 * published yet), then the realms by sites cleared with LORDS beside, the player's own row lit in place or pinned at
 * the foot when it ranks below the rows shown. A row opens its detail. When the season did not answer, the card says
 * so, with Try again.
 */
export const SeasonList = ({
  rank,
  chest,
  pool,
  rows,
  pinned,
  state,
  onRetry,
  onOpen,
  onBack,
}: {
  /** The player's rank; null for a player without a realm on the list, undefined while it loads. */
  rank: number | null | undefined;
  /** A common chest: its tier and the LORDS it pays at today's price; absent until the day's price is set. */
  chest?: { tier: Tier; lords: number };
  /** The season's pool; null while none is published, absent until the game's facts are known. */
  pool?: SeasonPoolFigures | null;
  rows: readonly SeasonListRow[];
  pinned: SeasonListRow | undefined;
  state: "ready" | "loading" | "failed";
  onRetry: () => void;
  onOpen: (key: string) => void;
  onBack: () => void;
}) => (
  <section
    aria-label={SEASON}
    className="frontier-card pointer-events-auto flex min-h-0 flex-1 flex-col gap-1 !rounded-xl p-2"
  >
    <header className="flex h-12 shrink-0 items-center gap-1.5">
      <button
        type="button"
        aria-label={BACK}
        onClick={onBack}
        className="-ml-1 flex size-12 shrink-0 items-center justify-center rounded-xl text-kit-cream"
      >
        <KitIcon code="Bk" size={26} />
      </button>
      <h2 className="frontier-title flex-1 !text-xl">{SEASON}</h2>
      {chest ? (
        <ChestChip tier={chest.tier} lords={chest.lords} rank={rank} />
      ) : (
        rank !== null && <Chip icons={["Tp"]} label={SEASON} value={rankShown(rank)} />
      )}
    </header>
    {pool !== undefined && <PoolLine pool={pool} />}
    {state === "failed" ? (
      <Failed onRetry={onRetry} />
    ) : (
      <>
        <BoardHead />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {state === "loading"
            ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <span key={index} className="h-[52px] shrink-0 animate-pulse border-b border-kit-line" />
              ))
            : rows.map((row) => <ListRow key={row.key} row={row} onOpen={onOpen} />)}
        </div>
        {pinned && <ListRow row={pinned} onOpen={onOpen} />}
      </>
    )}
  </section>
);

/**
 * The season's pool in whole LORDS and what today releases of it (absent before the season starts and after it ends),
 * then a share's price: today's once the day has opened, and the ceiling no day's price passes.
 */
export type SeasonPoolFigures = {
  lords: number;
  today: number | undefined;
  price: number | undefined;
  ceiling: number | undefined;
};

/**
 * The pool the season pays its chests from, two figures to a row: the LORDS deposited for it and today's share of
 * them, then what a share of a chest pays today and the most a day can set it to. A day sets its price at its first
 * ruin, so until then, and outside the season, the figures that stand are fewer and close up. Before the deposit is
 * published to the game there is no pool, said in the figures' place.
 */
const PoolLine = ({ pool }: { pool: SeasonPoolFigures | null }) =>
  pool === null ? (
    <p className="flex h-9 shrink-0 items-center gap-2 px-1 text-sm text-kit-muted">
      <KitIcon code="Hg" size={18} />
      {POOL_NOT_PUBLISHED}
    </p>
  ) : (
    <dl className="grid shrink-0 grid-cols-[auto_auto] justify-start gap-x-5 gap-y-1.5 whitespace-nowrap px-1 py-1.5 text-sm">
      <PoolFigure word={SEASON_POOL} value={formatExact(pool.lords)} />
      {pool.today !== undefined && <PoolFigure word={TODAY} value={`+${formatExact(pool.today)}`} />}
      {pool.price !== undefined && <PoolFigure word={PER_SHARE} value={formatExact(pool.price)} />}
      {pool.ceiling !== undefined && <PoolFigure word={SHARE_CEILING} value={formatExact(pool.ceiling)} />}
    </dl>
  );

const PoolFigure = ({ word, value }: { word: string; value: string }) => (
  <div className="flex items-center gap-1.5">
    <dt className="text-kit-muted">{word}</dt>
    <dd className="flex items-center gap-1 font-bold tabular-nums text-kit-cream">
      <KitIcon code="Lo" size={16} />
      {value}
    </dd>
  </div>
);

const ListRow = ({ row, onOpen }: { row: SeasonListRow; onOpen: (key: string) => void }) => (
  <SeasonRow
    rank={row.rank}
    order={row.order}
    name={row.name}
    sitesCleared={row.sitesCleared}
    lords={row.lords}
    own={row.own}
    onOpen={() => onOpen(row.key)}
  />
);

/**
 * The columns' icons over SeasonRow's numbers: sites cleared, then LORDS. Each icon names its column on the tooltip:
 * hover it, or press and hold it on a phone.
 */
const BoardHead = () => (
  <div className="flex h-6 shrink-0 items-center gap-2 px-1">
    <span className="flex-1" />
    <span role="img" aria-label={SITES_CLEARED} className="flex h-6 w-12 items-center justify-end">
      <KitIcon code="Fl" size={18} />
    </span>
    <span role="img" aria-label={LORDS_EARNED} className="flex h-6 w-14 items-center justify-end">
      <KitIcon code="Lo" size={18} />
    </span>
    <span className="w-[18px]" />
  </div>
);

const rankShown = (rank: number | undefined) => (rank === undefined ? "—" : `#${rank}`);

/**
 * A common chest (the chest, its tier, the LORDS it pays) and, after a rule, the player's rank: one chip, so the
 * header holds Back, the title and both numbers at 360 px.
 */
const ChestChip = ({ tier, lords, rank }: { tier: Tier; lords: number; rank: number | null | undefined }) => (
  <span
    role="img"
    aria-label={rank === null ? `${LORDS} ${lords}` : `${LORDS} ${lords}, ${SEASON} ${rankShown(rank)}`}
    className="frontier-chip h-7 shrink-0 !gap-1 !py-0"
  >
    <span className="contents">
      <KitIcon code="Ch" size={18} />
      <TierChip tier={tier} showWord={false} />
      <KitIcon code="Lo" size={18} />
      <span className="frontier-chip-number tabular-nums !text-base">{formatAmount(lords)}</span>
      {rank !== null && (
        <>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-kit-line2" />
          <KitIcon code="Tp" size={18} />
          <span className="frontier-chip-number tabular-nums !text-base">{rankShown(rank)}</span>
        </>
      )}
    </span>
  </span>
);

/** What failed, by name, with Try again on the card itself. */
const Failed = ({ onRetry }: { onRetry: () => void }) => (
  <div role="alert" className="flex flex-col items-center justify-center gap-2.5 px-4 py-6">
    <KitIcon code="Tp" size={40} />
    <p className="text-sm text-kit-cream">{SEASON_ERROR}</p>
    <Button role="secondary" word={TRY_AGAIN} onClick={onRetry} className="w-[150px]" />
  </div>
);
