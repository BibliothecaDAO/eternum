import { useNavigate } from "react-router-dom";

import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { SeasonRow } from "@/ui/design-system/kit/season-row";
import { boardRows, wholeLords } from "@/ui/features/frontier/board/standings";

import { type DirectoryGame, useLeaderboard, useRealmsPlayer } from "../herald";
import { ServiceFailure } from "../service-failure";
import { WORDS } from "../words";

/**
 * A Frontier season's first rows on Herald's board, with the player's own row after them when it ranks below. A row
 * opens the player.
 */
export const SeasonTop = ({ season, length }: { season: DirectoryGame; length: number }) => {
  const navigate = useNavigate();
  const { data: player } = useRealmsPlayer();
  const board = useLeaderboard({ chainId: season.chainId, gameId: season.game_id });
  const rows = board.data?.mode === "frontier" ? boardRows(board.data.entries, player, length) : [];
  return (
    <section className="flex flex-col gap-1 plate p-3">
      <h2 className="plate-title flex items-center gap-2 px-1 font-ui text-[15px] font-bold text-kit-cream">
        <KitIcon code="Tp" size={22} />
        {WORDS.season}
      </h2>
      {board.isError ? (
        <ServiceFailure service="season" error={board.error} retry={() => void board.refetch()} />
      ) : (
        rows.map(({ entry, own }) => (
          <SeasonRow
            key={entry.address}
            rank={entry.rank}
            order={entry.order}
            name={<PlayerName account={entry.address} you={own} portrait />}
            sitesCleared={entry.sites_cleared.total}
            lords={wholeLords(entry.rewards.lords)}
            own={own}
            onOpen={() => navigate(`/p/${entry.address}`)}
          />
        ))
      )}
    </section>
  );
};
