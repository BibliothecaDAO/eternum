import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { SeasonRow } from "@/ui/design-system/kit/season-row";
import { SEASON } from "@/ui/design-system/kit/words";

import { useSeasonBoard, useSeasonListRows } from "./season-board";
import type { SeasonListRow } from "./season-list";

/** How many of the season's leaders the desktop peek shows above the player's own row. */
const LEADERS = 5;

/** Desktop's season peek over Herald's board: the top five and the player's own row. */
export const SeasonPeek = ({ onOpen }: { onOpen: () => void }) => {
  const board = useSeasonBoard();
  const { rows, pinned } = useSeasonListRows(board.data, LEADERS);
  if (!board.data) return null;
  return <SeasonPeekView rows={pinned ? [...rows, pinned] : rows} onOpen={onOpen} />;
};

/**
 * Desktop's season peek under the nav (desktop.html): the season's leaders and the player's own row, sites cleared
 * and LORDS beside; a click anywhere opens the Season page. Hidden while a panel is open.
 */
export const SeasonPeekView = ({ rows, onOpen }: { rows: readonly SeasonListRow[]; onOpen: () => void }) => (
  <section aria-label={SEASON} className="frontier-card pointer-events-auto flex flex-col !rounded-xl px-1.5 py-1">
    <header aria-hidden className="flex h-7 items-center gap-2 px-1">
      <KitIcon code="Tp" size={18} />
      <span className="flex-1" />
      <KitIcon code="Fl" size={16} />
    </header>
    {rows.map((row) => (
      <SeasonRow
        key={row.key}
        rank={row.rank}
        order={row.order}
        name={row.name}
        sitesCleared={row.sitesCleared}
        lords={row.lords}
        own={row.own}
        onOpen={onOpen}
      />
    ))}
  </section>
);
