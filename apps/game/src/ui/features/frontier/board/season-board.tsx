import { useAccountStore } from "@/hooks/store/use-account-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { usePlayerDisplayName } from "@/hooks/use-player-profile";
import { getActiveGame } from "@/runtime/world";
import { startRealmVisit } from "@/sync/active-game-client";
import { Trophy } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { configManager } from "@bibliothecadao/eternum";
import { fetchHeraldLeaderboard, requireShard } from "@bibliothecadao/eternum/game-client";
import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { useQuery } from "@tanstack/react-query";
import { Chip } from "../frontier-chips";
import { FlagGlyph } from "../glyphs";
import { useWorkspaceTakesScreen } from "../use-workspace-takes-screen";
import { SeasonTable } from "./season-table";
import { boardRows, ownRank } from "./standings";

// The board shares the popover store's one-open rule, so opening any other surface closes it.
const BOARD_ID = "frontier-season-board";
const REFRESH_MS = 30_000;
const LIST_LENGTH = 50;
const PEEK_LENGTH = 5;

/**
 * Frontier's season board from Herald's read model: sites cleared, then deepest depth, then who reached the count
 * first. Herald ranks; the client only reads, and an unknown board shows as "—".
 */
const useSeasonBoard = () => {
  const shard = requireShard(getActiveGame()?.chainId);
  const gameId = configManager.getActiveGameId();
  return useQuery({
    queryKey: ["frontierSeasonBoard", shard.url, gameId],
    queryFn: async () => {
      const board = await fetchHeraldLeaderboard(shard, gameId);
      // The Frontier HUD only mounts in a Frontier game, whose board is always the season's.
      if (board.mode !== "frontier") throw new Error(`Game ${gameId} ranks points, not a Frontier season`);
      return board.entries;
    },
    refetchInterval: REFRESH_MS,
  });
};

const useViewer = () => useAccountStore((state) => state.account?.address ?? null);

/** The rank as the chip shows it: "—" while unknown, "#12" once known, the trophy alone for a viewer without a realm. */
const rankValue = (rank: number | null | undefined): string =>
  rank === undefined ? "—" : rank === null ? "" : `#${rank}`;

/** The rank chip in the strip's chip row (mockup 7): the trophy and the player's season rank, opening the board. */
export const SeasonBoardChip = () => {
  const toggle = usePopoverStore((state) => state.toggle);
  const open = usePopoverStore((state) => state.openId === BOARD_ID);
  const board = useSeasonBoard();
  const rank = rankValue(ownRank(board.data, useViewer()));

  return (
    <>
      <button
        type="button"
        aria-label="Season board"
        aria-expanded={open}
        onClick={() => toggle(BOARD_ID)}
        className="pointer-events-auto flex min-h-11 items-center lg:min-h-9"
      >
        <Chip label="Season rank" icon={<Trophy />} value={rank} />
      </button>
      {open && <SeasonBoardSheet rank={rank} />}
    </>
  );
};

/** Desktop's panel under the chip row (§3.10): the top five and the player's own row, opening the full board. */
export const SeasonBoardPeek = () => {
  const open = usePopoverStore((state) => state.open);
  const board = useSeasonBoard();
  const viewer = useViewer();

  return (
    <button
      type="button"
      aria-label="Season leaders"
      onClick={() => open(BOARD_ID)}
      className="frontier-card pointer-events-auto hidden w-72 flex-col gap-1 p-2 text-left font-sans lg:flex"
    >
      {!board.data ? (
        <span className="frontier-chip-number px-1.5">—</span>
      ) : (
        <ol className="w-full space-y-0.5">
          {boardRows(board.data, viewer, PEEK_LENGTH).map(({ entry, own }) => (
            <PeekRow key={entry.address} entry={entry} own={own} />
          ))}
        </ol>
      )}
    </button>
  );
};

/** The full board as a bottom sheet (§3.10): the top fifty, the player's own row always in view, a name to visit. */
const SeasonBoardSheet = ({ rank }: { rank: string }) => {
  const board = useSeasonBoard();
  const viewer = useViewer();
  const close = usePopoverStore((state) => state.close);
  useWorkspaceTakesScreen();
  const visit = (entry: HeraldFrontierLeaderboardEntry) => {
    startRealmVisit({ player: entry.address, structureId: Number(entry.structure_id) });
    close(BOARD_ID);
  };

  return (
    <section
      aria-label="Season board"
      data-frontier-sheet
      className="frontier-sheet pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex max-h-[80dvh] flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-sans landscape:inset-x-auto landscape:left-1/2 landscape:w-[min(560px,70vw)] landscape:-translate-x-1/2"
    >
      {/* The sheet's handle closes it, as a swipe down would. */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => close(BOARD_ID)}
        className="-mt-2 flex h-6 justify-center"
      >
        <span className="frontier-handle mt-1" />
      </button>
      <header className="flex justify-center">
        <Chip label="Season rank" icon={<Trophy />} value={rank} />
      </header>
      {board.data ? (
        <SeasonTable
          rows={boardRows(board.data, viewer, LIST_LENGTH)}
          useName={usePlayerDisplayName}
          onVisit={viewer === null ? undefined : visit}
        />
      ) : (
        <p className="frontier-hero text-center">—</p>
      )}
    </section>
  );
};

const PeekRow = ({ entry, own }: { entry: HeraldFrontierLeaderboardEntry; own: boolean }) => {
  const name = usePlayerDisplayName(entry.address) ?? "—";
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-lg px-1.5 py-0.5 text-[14px] text-[#eadfc8]",
        own && "bg-[#f6ac1d]/15",
      )}
    >
      <span className="w-7 shrink-0 text-center font-[Lexend] font-extrabold tabular-nums text-[#a2926f]">
        {entry.rank}
      </span>
      <span className="min-w-0 flex-1 truncate font-[Lexend] font-extrabold">{name}</span>
      <span className="flex items-center gap-1 tabular-nums" aria-label={`${entry.sites_cleared.total} sites cleared`}>
        <FlagGlyph className="size-4" />
        {entry.sites_cleared.total}
      </span>
    </li>
  );
};
