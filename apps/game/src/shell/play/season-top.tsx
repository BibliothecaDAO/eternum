import { useNavigate } from "react-router-dom";

import { PlayerName } from "@/ui/design-system/kit/player-name";
import { SeasonRow } from "@/ui/design-system/kit/season-row";
import { boardRows, wholeLords } from "@/ui/features/frontier/board/standings";

import { type DirectoryGame, useLeaderboard, useRealmsPlayer } from "../herald";
import { Panel } from "../panel";
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
    <Panel icon="Tp" title={WORDS.season}>
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
    </Panel>
  );
};
