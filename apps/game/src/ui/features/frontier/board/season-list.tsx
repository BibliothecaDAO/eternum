import { formatAmount, formatExact, formatMoment, LORDS, formatShort } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import {
  HudButton,
  HudChip,
  HudEmpty,
  HudIconButton,
  HudPanel,
  HudSkeleton,
  HudTableHead,
  HudTableRow,
} from "@/ui/design-system/kit/hud-elements";

import { useSheetCloses } from "@/ui/design-system/kit/sheet-closes";

import { RealmBadge } from "./realm-marks";
import {
  LORDS_EARNED,
  POOL_NOT_PUBLISHED,
  RANK,
  REALM,
  CLOSE,
  SEASON,
  SEASON_ERROR,
  SITES,
  SITES_CLEARED,
  TRY_AGAIN,
  commonChestPays,
  dayOfSeason,
  seasonEnds,
  seasonPool,
} from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/** A realm's row on the list, keyed to open its detail; `label` is its name as text, for assistive technology. */
export type SeasonListRow = {
  key: string;
  rank: number;
  order: number;
  /** The realm's rank and its depth, as the board's entry gives them. */
  realm: { level: number; depth: number };
  name: ReactNode;
  label: string;
  sitesCleared: number;
  lords: number;
  own: boolean;
};

/** How many skeleton rows stand in while the season loads. */
const SKELETON_ROWS = 8;

/**
 * Season (wireframe 13), a place of its own, left by the place bar: the title with what a common chest pays today and
 * the player's rank, the season's pool on that chip's tip, then the realms by sites cleared with LORDS beside, the
 * player's own row lit in place or pinned at the foot when it ranks below the rows shown. A row opens its detail. When
 * the season did not answer, the card says so, with Try again. It closes as every panel does: its X, Escape or back.
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
  onClose,
  ends,
}: {
  /** The player's rank; null for a player without a realm on the list, undefined while it loads. */
  rank: number | null | undefined;
  /** What a common chest pays at today's price; absent until the day's price is set. */
  chest?: { lords: number };
  /** The season's pool; null while none is published, absent until the game's facts are known. */
  pool?: SeasonPoolFigures | null;
  rows: readonly SeasonListRow[];
  pinned: SeasonListRow | undefined;
  state: "ready" | "loading" | "failed";
  onRetry: () => void;
  onOpen: (key: string) => void;
  onClose: () => void;
  /** When the season ends, and today against its last day while it runs; undefined until the game is known. */
  ends?: { at: number; day?: number; lastDay?: number };
}) => {
  useSheetCloses(onClose);
  return (
    <HudPanel
      label={SEASON}
      collapsible={false}
      className="pointer-events-auto flex min-h-0 flex-1 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col gap-1"
    >
      <header className="flex shrink-0 items-center gap-1.5">
        <h2 className="flex-1 text-hud-title text-hud-accent">{SEASON}</h2>
        <SeasonChip chest={chest} rank={rank} pool={pool} />
        <HudIconButton icon="close" label={CLOSE} kind="quiet" size="sm" onClick={onClose} />
      </header>
      {ends && <SeasonEnds {...ends} />}
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
};

/** When the season ends, and today against its last day: "Season ends 31 Oct 21:40 · Day 10 of 14". */
const SeasonEnds = ({ at, day, lastDay }: { at: number; day?: number; lastDay?: number }) => (
  <p className="shrink-0 text-hud-label tabular-nums text-hud-muted">
    {[
      seasonEnds(formatMoment(at)),
      day !== undefined && lastDay !== undefined && dayOfSeason(formatAmount(day), formatAmount(lastDay)),
    ]
      .filter(Boolean)
      .join(" · ")}
  </p>
);

/** The season's pool in whole LORDS and what today releases of it (absent before the season starts and after it ends). */
export type SeasonPoolFigures = { lords: number; today: number | undefined };

/** Rank, the realm's rank and depth, name, sites cleared (what ranks) and LORDS: the head and rows share these columns. */
const COLS = "2.25rem 1.75rem minmax(0, 1fr) 3rem 3.5rem";

/** One realm on the list, a row of the sheet's table that opens its detail; the player's own carries the chosen bar. */
const ListRow = ({ row, onOpen }: { row: SeasonListRow; onOpen: (key: string) => void }) => (
  <HudTableRow cols={COLS} label={`#${row.rank} ${row.label}`} selected={row.own} onClick={() => onOpen(row.key)}>
    <span className="text-center tabular-nums">{formatAmount(row.rank)}</span>
    <RealmBadge level={row.realm.level} depth={row.realm.depth} />
    <span className="min-w-0 truncate">{row.name}</span>
    <span className="text-right tabular-nums">{formatAmount(row.sitesCleared)}</span>
    <span className="text-right tabular-nums">{formatAmount(row.lords)}</span>
  </HudTableRow>
);

/**
 * Each column's name over it, as Blitz's standings name theirs: Rank, the realm (its rank and depth, and name), Sites cleared
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
 * What a common chest pays today and the player's rank, one chip so the header holds the title and both numbers at
 * 360 px. The pool behind the chest is the chip's tip (hover, or press-and-hold), or that none is published yet.
 */
const SeasonChip = ({
  chest,
  rank,
  pool,
}: {
  chest: { lords: number } | undefined;
  rank: number | null | undefined;
  pool: SeasonPoolFigures | null | undefined;
}) => {
  if (!chest && rank === null) return null;
  const said = [chest && `${LORDS} ${chest.lords}`, rank !== null && `${SEASON} ${rankShown(rank)}`].filter(Boolean);
  const tip = [chest && commonChestPays(formatExact(chest.lords)), poolLine(pool)].filter(Boolean);
  return (
    <span role="img" aria-label={said.join(", ")} data-tip={tip.join(". ")} className="inline-flex shrink-0">
      <HudChip>
        {chest && (
          <>
            <SemanticIcon name="chest" size={16} />
            <SemanticIcon name="lords" size={16} />
            <span className="tabular-nums">{formatShort(chest.lords)}</span>
          </>
        )}
        {chest && rank !== null && <span aria-hidden className="mx-0.5 h-4 w-px bg-hud-divider" />}
        {rank !== null && (
          <>
            <SemanticIcon name="victory" size={16} />
            <span className="tabular-nums">{rankShown(rank)}</span>
          </>
        )}
      </HudChip>
    </span>
  );
};

/** The pool on the chip's tip: its LORDS and today's release, that none is published, or nothing while unknown. */
const poolLine = (pool: SeasonPoolFigures | null | undefined) =>
  pool === null
    ? POOL_NOT_PUBLISHED
    : pool && seasonPool(formatExact(pool.lords), pool.today === undefined ? undefined : formatExact(pool.today));

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
