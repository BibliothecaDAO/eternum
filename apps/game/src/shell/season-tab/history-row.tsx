import { formatAmount, formatClockTime, formatOrdinal, UNKNOWN } from "@bibliothecadao/types";
import { useLocation, useNavigate } from "react-router-dom";

import { findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";

import { clockLine } from "@/ui/design-system/kit/clock-chip";
import { AppChip, AppRow } from "@/ui/design-system/kit/app-elements";
import { RowThumb } from "@/ui/design-system/kit/list-row";
import { openedFrom } from "../frame/opened-from";
import { type DirectoryGame, gameRefOf, useLeaderboard } from "../herald";
import { ageOf, type AgeMode } from "../play/ages";
import { resultsHref } from "./results-link";

const ageOfGame = (game: DirectoryGame): AgeMode => (game.mode === "frontier" ? "frontier" : "blitz");

export const gameStart = (game: DirectoryGame) => formatClockTime(game.clock.start_main_at);

const gameTitle = (game: DirectoryGame) => `${ageOf(ageOfGame(game)).name} ${gameStart(game)}`;

const usePlace = (game: DirectoryGame, player: string) => {
  const board = useLeaderboard(game);
  const own = board.data ? findOwnEntry(board.data.entries, player) : undefined;
  return { rank: own?.rank, lords: own && wholeLords(own.rewards.lords) };
};

/**
 * A finished game on a player's list (spec 10): its age's painting, its title and date, the player's place, and LORDS
 * for a Frontier season. The row opens the game's Results, with You lit as the way back to the list.
 */
export const HistoryRow = ({ game, player, now }: { game: DirectoryGame; player: string; now: number }) => {
  const { rank, lords } = usePlace(game, player);
  const here = useLocation();
  const navigate = useNavigate();
  return (
    <AppRow
      lead={<RowThumb painting={ageOf(ageOfGame(game)).painting} size={10} />}
      title={gameTitle(game)}
      detail={clockLine(null, game.clock.end_at, now)}
      onClick={() => navigate(resultsHref(gameRefOf(game)), { state: openedFrom(here) })}
      trail={
        <>
          {lords !== undefined && (
            <AppChip tone="gold" icon="lords">
              {formatAmount(lords)}
            </AppChip>
          )}
          <span className="w-12 text-right text-app-strong tabular-nums text-app-ink">
            {rank === undefined ? UNKNOWN : formatOrdinal(rank)}
          </span>
        </>
      }
    />
  );
};
