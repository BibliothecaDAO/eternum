import { formatAmount, formatClockTime, formatOrdinal } from "@bibliothecadao/types";
import { useLocation, useNavigate } from "react-router-dom";

import { findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";

import { clockLine } from "@/ui/design-system/kit/clock-chip";
import { AppChip, AppRow } from "@/ui/design-system/kit/app-elements";
import { RowThumb } from "@/ui/design-system/kit/list-row";
import { openedFrom } from "../frame/opened-from";
import { isSameStarknetAddress } from "@realms-world/identity";
import { type DirectoryGame, gameRefOf, useLeaderboard } from "../herald";
import { ageOf, type AgeMode } from "../play/ages";
import { resultsHref } from "./results-link";

const ageOfGame = (game: DirectoryGame): AgeMode => (game.mode === "frontier" ? "frontier" : "blitz");

/** A finished game's title, like its lobby's: its mode and its start time ("Blitz 15:00"). */
export const gameTitle = (game: DirectoryGame) =>
  `${ageOf(ageOfGame(game)).name} ${formatClockTime(game.clock.start_main_at)}`;

/** The player's place in a finished game ("3rd"), and for a Frontier season the LORDS its Ruin chests paid. */
const usePlace = (game: DirectoryGame, player: string) => {
  const board = useLeaderboard(gameRefOf(game));
  if (board.data?.mode === "frontier") {
    const own = findOwnEntry(board.data.entries, player);
    return { rank: own?.rank, lords: own && wholeLords(own.rewards.lords) };
  }
  const entry = board.data?.entries.find((candidate) => isSameStarknetAddress(candidate.address, player));
  return { rank: entry?.rank, lords: undefined };
};

/**
 * A finished game on a player's list (spec 10): its age's painting, its title and date, the player's place, and LORDS
 * for a Frontier season. The row opens the game's Results, whose Back leads back to the list.
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
            {rank === undefined ? "—" : formatOrdinal(rank)}
          </span>
        </>
      }
    />
  );
};
