import { formatAmount } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { SeasonRow } from "@/ui/design-system/kit/season-row";
import { type Tier, TierChip } from "@/ui/design-system/kit/tier-chip";
import { BACK, LORDS, SEASON, SEASON_ERROR, TRY_AGAIN } from "@/ui/design-system/kit/words";
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
 * Season (wireframe 13), a page from the Menu, so it has Back: the title with today's common chest and the player's
 * rank, then the realms by sites cleared with LORDS beside, the player's own row lit in place or pinned at the foot when
 * it ranks below the rows shown. A row opens its detail. When the season did not answer, the card says so, with Try
 * again.
 */
export const SeasonList = ({
  rank,
  chest,
  rows,
  pinned,
  state,
  onRetry,
  onOpen,
  onBack,
}: {
  /** The player's rank; null for a player without a realm on the list, undefined while it loads. */
  rank: number | null | undefined;
  /** Today's common chest: its tier and the LORDS it pays; absent until the day's chest price is read. */
  chest?: { tier: Tier; lords: number };
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
      <h2 className="frontier-title flex-1 !text-[20px]">{SEASON}</h2>
      {chest && <ChestChip tier={chest.tier} lords={chest.lords} />}
      {rank !== null && <Chip icons={["Tp"]} label={SEASON} value={rank === undefined ? "—" : `#${rank}`} />}
    </header>
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

/** The columns' icons over SeasonRow's numbers: sites cleared, then LORDS. */
const BoardHead = () => (
  <div aria-hidden className="flex h-6 shrink-0 items-center gap-2 px-1">
    <span className="flex-1" />
    <span className="flex w-12 justify-end">
      <KitIcon code="Fl" size={18} />
    </span>
    <span className="flex w-14 justify-end">
      <KitIcon code="Lo" size={18} />
    </span>
    <span className="w-[18px]" />
  </div>
);

/** Today's common chest: the chest, its tier, and the LORDS it pays. */
const ChestChip = ({ tier, lords }: { tier: Tier; lords: number }) => (
  <span role="img" aria-label={`${LORDS} ${lords}`} className="frontier-chip h-7 shrink-0 !gap-1 !py-0">
    <span className="contents">
      <KitIcon code="Ch" size={18} />
      <TierChip tier={tier} showWord={false} />
      <KitIcon code="Lo" size={18} />
      <span className="frontier-chip-number tabular-nums !text-[15px]">{formatAmount(lords)}</span>
    </span>
  </span>
);

/** What failed, by name, with Try again on the card itself. */
const Failed = ({ onRetry }: { onRetry: () => void }) => (
  <div role="alert" className="flex flex-col items-center justify-center gap-2.5 px-4 py-6">
    <KitIcon code="Tp" size={40} />
    <p className="text-[14px] text-kit-cream">{SEASON_ERROR}</p>
    <Button role="secondary" word={TRY_AGAIN} onClick={onRetry} className="w-[150px]" />
  </div>
);
