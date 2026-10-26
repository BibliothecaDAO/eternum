import { formatAmount, formatCharge, formatExact, LORDS } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import {
  HudButton,
  HudChip,
  HudEmpty,
  HudIconButton,
  HudPanel,
  HudRarity,
  HudSkeleton,
  HudTableHead,
  HudTableRow,
} from "@/ui/design-system/kit/hud-elements";

import { RealmBadge } from "./realm-marks";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import {
  BACK,
  LORDS_EARNED,
  PER_SHARE,
  POOL_NOT_PUBLISHED,
  RANK,
  REALM,
  SEASON,
  SEASON_ERROR,
  SHARE_CEILING,
  SITES,
  SITES_CLEARED,
  TODAY,
  TRY_AGAIN,
} from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/** A realm's row on the list, keyed to open its detail; `label` is its name as text, for assistive technology. */
export type SeasonListRow = {
  key: string;
  rank: number;
  order: number;
  /** The realm's rank and its deepest reach, as the board's entry gives them. */
  realm: { level: number; reach: number };
  name: ReactNode;
  label: string;
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
  <HudPanel
    label={SEASON}
    collapsible={false}
    className="pointer-events-auto flex min-h-0 flex-1 flex-col"
    bodyClassName="flex min-h-0 flex-1 flex-col gap-1"
  >
    <header className="flex shrink-0 items-center gap-1.5">
      <HudIconButton icon="arrow-left" label={BACK} kind="quiet" onClick={onBack} />
      <h2 className="flex-1 text-hud-title text-hud-accent">{SEASON}</h2>
      {chest ? (
        <ChestChip tier={chest.tier} lords={chest.lords} rank={rank} />
      ) : (
        rank !== null && (
          <HudChip icons={["victory"]} label={SEASON}>
            {rankShown(rank)}
          </HudChip>
        )
      )}
    </header>
    {pool !== undefined && <PoolLine pool={pool} />}
    {state === "failed" ? (
      <Failed onRetry={onRetry} />
    ) : (
      <>
        <BoardHead />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {state === "loading" ? (
            <HudSkeleton rows={SKELETON_ROWS} />
          ) : (
            rows.map((row) => <ListRow key={row.key} row={row} onOpen={onOpen} />)
          )}
        </div>
        {pinned && <ListRow row={pinned} onOpen={onOpen} />}
      </>
    )}
  </HudPanel>
);

/**
 * The season's pool in whole LORDS and what today releases of it (absent before the season starts and after it ends),
 * then a share's price: today's once the day has opened, and the ceiling no day's price passes.
 */
export type SeasonPoolFigures = {
  prize?: { lords: number; topN: number };
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
    <p className="flex h-9 shrink-0 items-center gap-2 px-1 text-hud-body text-hud-muted">
      <SemanticIcon name="hourglass" size={18} />
      {POOL_NOT_PUBLISHED}
    </p>
  ) : (
    <dl className="flex shrink-0 flex-wrap gap-x-5 gap-y-1.5 whitespace-nowrap px-1 py-1.5 text-hud-body">
      <PoolFigure word="Chests" value={formatExact(pool.lords)} />
      {pool.prize && <PoolFigure word={`Top ${pool.prize.topN}`} value={formatExact(pool.prize.lords)} />}
      {pool.today !== undefined && <PoolFigure word={TODAY} value={`+${formatExact(pool.today)}`} />}
      {pool.price !== undefined && <PoolFigure word={PER_SHARE} value={formatCharge(pool.price)} />}
      {pool.ceiling !== undefined && <PoolFigure word={SHARE_CEILING} value={formatExact(pool.ceiling)} />}
    </dl>
  );

const PoolFigure = ({ word, value }: { word: string; value: string }) => (
  <div className="flex items-center gap-1.5">
    <dt className="text-hud-muted">{word}</dt>
    <dd className="flex items-center gap-1 text-hud-strong tabular-nums">
      <SemanticIcon name="lords" size={16} />
      {value}
    </dd>
  </div>
);

/** Rank, the realm's rank and reach, name, sites cleared (what ranks) and LORDS: the head and rows share these columns. */
const COLS = "2.25rem 1.75rem minmax(0, 1fr) 3rem 3.5rem";

/** One realm on the list, a row of the sheet's table that opens its detail; the player's own carries the chosen bar. */
const ListRow = ({ row, onOpen }: { row: SeasonListRow; onOpen: (key: string) => void }) => (
  <HudTableRow cols={COLS} label={`#${row.rank} ${row.label}`} selected={row.own} onClick={() => onOpen(row.key)}>
    <span className="text-center tabular-nums">{formatAmount(row.rank)}</span>
    <RealmBadge level={row.realm.level} reach={row.realm.reach} />
    <span className="min-w-0 truncate">{row.name}</span>
    <span className="text-right tabular-nums">{formatAmount(row.sitesCleared)}</span>
    <span className="text-right tabular-nums">{formatAmount(row.lords)}</span>
  </HudTableRow>
);

/**
 * Each column's name over it, as Blitz's standings name theirs: Rank, the realm (its rank and reach, and name), Sites cleared
 * (what ranks) and LORDS. The number columns' full names are on their heads' tooltip.
 */
const BoardHead = () => (
  <HudTableHead cols={COLS}>
    <span className="text-center">{RANK}</span>
    <span className="col-span-2">{REALM}</span>
    <span className="text-right" data-tip={SITES_CLEARED}>
      {SITES}
    </span>
    <span className="text-right" data-tip={LORDS_EARNED}>
      {LORDS}
    </span>
  </HudTableHead>
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
    className="inline-flex shrink-0"
  >
    <HudChip>
      <SemanticIcon name="chest" size={16} />
      {/* The pips always carry their word here: beside the rank, bare pips read as the realm's own tier. */}
      <HudRarity tier={tier} word />
      <SemanticIcon name="lords" size={16} />
      <span className="tabular-nums">{formatAmount(lords)}</span>
      {rank !== null && (
        <>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-hud-divider" />
          <SemanticIcon name="victory" size={16} />
          <span className="tabular-nums">{rankShown(rank)}</span>
        </>
      )}
    </HudChip>
  </span>
);

/** What failed, by name, with Try again on the card itself. */
const Failed = ({ onRetry }: { onRetry: () => void }) => (
  <div role="alert">
    <HudEmpty
      icon="victory"
      line={SEASON_ERROR}
      action={
        <HudButton kind="secondary" onClick={onRetry}>
          {TRY_AGAIN}
        </HudButton>
      }
    />
  </div>
);
